const db = require('../models');
const inngest = require('../jobs/client');
const logger = require('../utils/logger');
const conversationService = require('./conversation.service');
const githubPr = require('../integrations/github/pull-request-client');
const { REVIEW_JOB_STATUSES } = require('../constants/review-job-status');

const HANDLED_PR_ACTIONS = ['opened', 'synchronize', 'reopened'];

/**
 * pull_request.opened / .synchronize / .reopened / .closed (merged) — entry point into review & indexing.
 * Does the minimum synchronous work (upsert installation/repo/PR, create a PENDING ReviewJob,
 * emit the event) then returns — the actual pipeline runs in jobs/review-pipeline.job.js
 * (ADR-005). Wrapped in one transaction so a partial write never leaves an orphaned PR
 * without a ReviewJob, or vice versa.
 */
async function handlePullRequestEvent(payload) {
  const { action, pull_request: pr, repository, installation } = payload;

  // Handle PR merge for automatic incremental indexing
  if (action === 'closed' && pr?.merged) {
    if (!installation) return null;

    const repositoryRow = await db.Repository.findOne({
      where: { githubRepoId: repository.id },
    });
    if (!repositoryRow || repositoryRow.indexStatus !== 'INDEXED') {
      return null;
    }

    const defaultBranch = repository.default_branch || 'main';
    if (pr.base?.ref !== defaultBranch) {
      return null;
    }

    try {
      const changedFiles = await githubPr.listChangedFiles({
        installationId: installation.id,
        owner: repository.owner.login,
        repo: repository.name,
        pullNumber: pr.number,
      });

      const changedPaths = (changedFiles || []).map((f) => f.filename);

      await inngest.send({
        name: 'repo/push.default-branch',
        data: {
          repositoryId: repositoryRow.id,
          installationId: installation.id,
          owner: repository.owner.login,
          repo: repository.name,
          branch: defaultBranch,
          changedFiles: changedPaths,
          headSha: pr.merge_commit_sha || null,
        },
      });

      logger.info(
        { repoId: repositoryRow.id, prNumber: pr.number, changedFiles: changedPaths.length },
        'incremental indexing triggered via PR merge',
      );
    } catch (err) {
      logger.error({ err, repoId: repositoryRow.id }, 'failed to trigger incremental indexing on PR merge');
    }
    return null;
  }

  if (!HANDLED_PR_ACTIONS.includes(action)) {
    logger.info({ action }, 'ignoring unhandled pull_request action');
    return null;
  }

  if (!installation) {
    logger.warn({ action }, 'pull_request event missing installation — ignoring');
    return null;
  }

  const reviewJob = await db.sequelize.transaction(async (transaction) => {
    const existingUser = await db.User.findOne({
      where: { githubUserId: repository.owner.id },
      transaction,
    });

    const [installationRow] = await db.Installation.findOrCreate({
      where: { githubInstallationId: installation.id },
      defaults: {
        githubInstallationId: installation.id,
        accountLogin: repository.owner.login,
        installedByUserId: existingUser?.id || null,
      },
      transaction,
    });

    // If an existing installation had no user linked, link it now if user exists
    if (existingUser && !installationRow.installedByUserId) {
      await installationRow.update({ installedByUserId: existingUser.id }, { transaction });
    }

    const [repositoryRow] = await db.Repository.findOrCreate({
      where: { githubRepoId: repository.id },
      defaults: {
        installationId: installationRow.id,
        githubRepoId: repository.id,
        fullName: repository.full_name,
        isActive: true,
      },
      transaction,
    });

    const [pullRequestRow] = await db.PullRequest.upsert(
      {
        repositoryId: repositoryRow.id,
        githubPrNumber: pr.number,
        title: pr.title,
        headSha: pr.head.sha,
        baseSha: pr.base.sha,
        authorLogin: pr.user.login,
      },
      { transaction, returning: true },
    );

    const job = await db.ReviewJob.create(
      {
        pullRequestId: pullRequestRow.id,
        status: REVIEW_JOB_STATUSES.PENDING,
      },
      { transaction },
    );

    await db.JobEvent.create(
      {
        reviewJobId: job.id,
        step: 'webhook_received',
        status: 'succeeded',
        detail: { action, installationId: installation.id, repository: repository.full_name },
      },
      { transaction },
    );

    return job;
  });

  // Emit only after the transaction commits — never emit an event for a write that might
  // still roll back.
  await inngest.send({
    name: 'pr/review.requested',
    data: {
      reviewJobId: reviewJob.id,
      installationId: installation.id,
      owner: repository.owner.login,
      repo: repository.name,
      pullNumber: pr.number,
    },
  });

  logger.info({ reviewJobId: reviewJob.id }, 'review pipeline triggered');
  return reviewJob;
}

/**
 * issue_comment.created — checks the @mention-only trigger rule (ADR-009, D4) and, if it
 * matches, emits an event for jobs/handle-comment-reply.job.js to pick up.
 */
async function handleIssueCommentEvent(payload) {
  const { action, comment, issue, repository, installation } = payload;

  if (action !== 'created') return null;
  if (comment.user?.type === 'Bot') return null; // never react to our own (or another bot's) comments
  if (!issue.pull_request) return null; // plain issue comment, not a PR comment
  if (!conversationService.isDirectedAtBot(comment.body)) return null;

  const repositoryRow = await db.Repository.findOne({
    where: { githubRepoId: repository.id },
  });
  if (!repositoryRow) {
    logger.warn({ repo: repository.full_name }, 'comment on an unknown repository — ignoring');
    return null;
  }

  const pullRequestRow = await db.PullRequest.findOne({
    where: { repositoryId: repositoryRow.id, githubPrNumber: issue.number },
  });
  if (!pullRequestRow) return null;

  const reviewJob = await db.ReviewJob.findOne({
    where: { pullRequestId: pullRequestRow.id },
    order: [['createdAt', 'DESC']],
  });
  if (!reviewJob) {
    logger.info({ pr: issue.number }, 'mention on a PR with no review yet — ignoring');
    return null;
  }

  await db.ConversationMessage.create({
    reviewJobId: reviewJob.id,
    githubCommentId: comment.id,
    authorType: db.ConversationMessage.AUTHOR_TYPES.USER,
    authorLogin: comment.user.login,
    body: comment.body,
  });

  await inngest.send({
    name: 'pr/comment.received',
    data: {
      reviewJobId: reviewJob.id,
      installationId: installation.id,
      owner: repository.owner.login,
      repo: repository.name,
      pullNumber: issue.number,
    },
  });

  logger.info({ reviewJobId: reviewJob.id }, 'conversational reply triggered');
  return reviewJob;
}

/**
 * installation_repositories.added — triggered when repos are added to the GitHub App installation.
 * Emits indexing events for each newly-added repository.
 */
async function handleInstallationRepositoriesEvent(payload) {
  const { action, installation, repositories_added: reposAdded } = payload;

  if (action !== 'added' || !reposAdded?.length) return null;

  const existingUser = await db.User.findOne({
    where: { githubUserId: installation.account.id },
  });

  const [installationRow] = await db.Installation.findOrCreate({
    where: { githubInstallationId: installation.id },
    defaults: {
      githubInstallationId: installation.id,
      accountLogin: installation.account.login,
      installedByUserId: existingUser?.id || null,
    },
  });

  for (const repo of reposAdded) {
    const [repositoryRow, created] = await db.Repository.findOrCreate({
      where: { githubRepoId: repo.id },
      defaults: {
        installationId: installationRow.id,
        githubRepoId: repo.id,
        fullName: repo.full_name,
        isActive: true,
      },
    });

    if (created || repositoryRow.indexStatus === 'NOT_INDEXED') {
      const [owner, repoName] = repo.full_name.split('/');
      await inngest.send({
        name: 'repo/index.requested',
        data: {
          repositoryId: repositoryRow.id,
          installationId: installation.id,
          owner,
          repo: repoName,
          branch: 'main',
        },
      });
      logger.info({ repoId: repositoryRow.id, fullName: repo.full_name }, 'initial indexing triggered');
    }
  }

  return reposAdded.length;
}

/**
 * push — triggered on every push. We only care about pushes to the default branch
 * (i.e., PR merges) for incremental indexing.
 */
async function handlePushEvent(payload) {
  const { ref, repository, installation, commits, head_commit: headCommit } = payload;

  // Only process pushes to the default branch
  const defaultBranch = repository.default_branch || 'main';
  const expectedRef = `refs/heads/${defaultBranch}`;
  if (ref !== expectedRef) return null;

  const repositoryRow = await db.Repository.findOne({
    where: { githubRepoId: repository.id },
  });
  if (!repositoryRow) return null;

  // Only run incremental index if the repo is already indexed
  if (repositoryRow.indexStatus !== 'INDEXED') return null;

  // Collect unique changed file paths from commits
  const changedFiles = new Set();
  for (const commit of (commits || [])) {
    (commit.added || []).forEach((f) => changedFiles.add(f));
    (commit.modified || []).forEach((f) => changedFiles.add(f));
    (commit.removed || []).forEach((f) => changedFiles.add(f));
  }

  const [owner, repoName] = repository.full_name.split('/');
  await inngest.send({
    name: 'repo/push.default-branch',
    data: {
      repositoryId: repositoryRow.id,
      installationId: installation.id,
      owner,
      repo: repoName,
      branch: defaultBranch,
      changedFiles: [...changedFiles],
      headSha: headCommit?.id || null,
    },
  });

  logger.info(
    { repoId: repositoryRow.id, changedFiles: changedFiles.size },
    'incremental indexing triggered',
  );
  return changedFiles.size;
}

/**
 * installation.created — triggered when the GitHub App is first installed on an account.
 * Contains the full list of repositories selected during installation in `payload.repositories`.
 * This is distinct from `installation_repositories.added` which fires when repos are added
 * to an existing installation incrementally.
 */
async function handleInstallationEvent(payload) {
  const { action, installation, repositories } = payload;

  if (action !== 'created' || !repositories?.length) return null;

  const existingUser = await db.User.findOne({
    where: { githubUserId: installation.account.id },
  });

  const [installationRow] = await db.Installation.findOrCreate({
    where: { githubInstallationId: installation.id },
    defaults: {
      githubInstallationId: installation.id,
      accountLogin: installation.account.login,
      installedByUserId: existingUser?.id || null,
    },
  });

  // Link user if the installation was created before the user logged in
  if (existingUser && !installationRow.installedByUserId) {
    await installationRow.update({ installedByUserId: existingUser.id });
  }

  for (const repo of repositories) {
    const [repositoryRow, created] = await db.Repository.findOrCreate({
      where: { githubRepoId: repo.id },
      defaults: {
        installationId: installationRow.id,
        githubRepoId: repo.id,
        fullName: repo.full_name,
        isActive: true,
      },
    });

    if (created || repositoryRow.indexStatus === 'NOT_INDEXED') {
      const [owner, repoName] = repo.full_name.split('/');
      await inngest.send({
        name: 'repo/index.requested',
        data: {
          repositoryId: repositoryRow.id,
          installationId: installation.id,
          owner,
          repo: repoName,
          branch: 'main',
        },
      });
      logger.info({ repoId: repositoryRow.id, fullName: repo.full_name }, 'initial indexing triggered via installation');
    }
  }

  return repositories.length;
}

module.exports = {
  handlePullRequestEvent,
  handleIssueCommentEvent,
  handleInstallationRepositoriesEvent,
  handleInstallationEvent,
  handlePushEvent,
};

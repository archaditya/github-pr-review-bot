const db = require('../models');
const inngest = require('../jobs/client');
const logger = require('../utils/logger');
const conversationService = require('./conversation.service');
const { REVIEW_JOB_STATUSES } = require('../constants/review-job-status');

const HANDLED_PR_ACTIONS = ['opened', 'synchronize', 'reopened'];

/**
 * pull_request.opened / .synchronize / .reopened — the entry point into the review pipeline.
 * Does the minimum synchronous work (upsert installation/repo/PR, create a PENDING ReviewJob,
 * emit the event) then returns — the actual pipeline runs in jobs/review-pipeline.job.js
 * (ADR-005). Wrapped in one transaction so a partial write never leaves an orphaned PR
 * without a ReviewJob, or vice versa.
 */
async function handlePullRequestEvent(payload) {
  const { action, pull_request: pr, repository, installation } = payload;

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

module.exports = { handlePullRequestEvent, handleIssueCommentEvent };

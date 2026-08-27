const db = require('../models');
const { NotFoundError, ForbiddenError } = require('../utils/errors');

/**
 * Every method here is scoped to repositories the requesting user actually owns (via
 * their Installations) — mirrors the isolation rule in docs/architecture/data-model.md.
 * A user can never read or modify a repository they don't have access to, even by
 * guessing another repository's id.
 */

async function listForUser(userId) {
  const installations = await db.Installation.findAll({
    where: { installedByUserId: userId },
    include: [{ model: db.Repository, as: 'repositories' }],
  });

  return installations.flatMap((installation) => installation.repositories);
}

async function getForUser(userId, repositoryId) {
  const repository = await db.Repository.findByPk(repositoryId, {
    include: [{ model: db.Installation, as: 'installation' }],
  });

  if (!repository) throw new NotFoundError('Repository not found');
  if (repository.installation.installedByUserId !== userId) {
    throw new ForbiddenError('You do not have access to this repository');
  }

  return repository;
}

/**
 * Toggles whether the bot reviews PRs on this repo.
 */
async function setActive(userId, repositoryId, isActive) {
  const repository = await getForUser(userId, repositoryId);
  await repository.update({ isActive });
  return repository;
}

async function runIndexJob({ repositoryId, installationId, owner, repo, branch }) {
  const { getInstallationToken } = require('../integrations/github/app-auth');
  const indexerClient = require('../integrations/indexer-service-client');
  const eventBus = require('./event-bus.service');
  const logger = require('../utils/logger');

  try {
    const token = await getInstallationToken(installationId);
    const result = await indexerClient.requestFullIndex({
      repoId: repositoryId,
      owner,
      repo,
      token,
      branch,
    });

    await db.Repository.update(
      {
        indexStatus: 'INDEXED',
        indexedCommitSha: result.commit_sha,
        indexedAt: new Date(),
        fileCount: result.file_count || 0,
        symbolCount: result.symbol_count || 0,
        indexError: null,
      },
      { where: { id: repositoryId } },
    );

    eventBus.emitIndexStatusChange({
      repositoryId,
      indexStatus: 'INDEXED',
      fileCount: result.file_count || 0,
      symbolCount: result.symbol_count || 0,
    });
    logger.info({ repositoryId, files: result.file_count, symbols: result.symbol_count }, 'indexing completed successfully');
  } catch (err) {
    logger.error({ repositoryId, err: err.message }, 'indexing failed');
    await db.Repository.update(
      { indexStatus: 'FAILED', indexError: err.message },
      { where: { id: repositoryId } },
    );
    eventBus.emitIndexError({ repositoryId, error: err.message });
    eventBus.emitIndexStatusChange({ repositoryId, indexStatus: 'FAILED' });
  }
}

async function triggerReindex(userId, repositoryId) {
  const inngest = require('../jobs/client');
  const eventBus = require('./event-bus.service');
  const repository = await getForUser(userId, repositoryId);

  await repository.update({ indexStatus: 'INDEXING', indexError: null });
  eventBus.emitIndexStatusChange({ repositoryId: repository.id, indexStatus: 'INDEXING' });

  const [owner, repoName] = repository.fullName.split('/');
  const jobPayload = {
    repositoryId: repository.id,
    installationId: repository.installation.githubInstallationId,
    owner,
    repo: repoName,
    branch: repository.defaultBranch || 'main',
  };

  // Dispatch via Inngest and also execute in background worker
  inngest.send({ name: 'repo/index.requested', data: jobPayload }).catch(() => {});
  runIndexJob(jobPayload).catch(() => {});

  return repository;
}

async function resetIndex(userId, repositoryId) {
  const repository = await getForUser(userId, repositoryId);
  await repository.update({
    indexStatus: 'NOT_INDEXED',
    indexError: null,
  });

  const eventBus = require('./event-bus.service');
  eventBus.emitIndexStatusChange({
    repositoryId: repository.id,
    indexStatus: 'NOT_INDEXED',
  });

  return repository;
}

async function syncForUser(userId) {
  const user = await db.User.findByPk(userId);
  if (!user) return [];

  const logger = require('../utils/logger');
  const { getApp, getInstallationOctokit } = require('../integrations/github/app-auth');

  try {
    const app = await getApp();
    const { data: appInstallations } = await app.octokit.request('GET /app/installations');
    for (const inst of appInstallations) {
      if (
        inst.account &&
        (inst.account.id === user.githubUserId ||
          inst.account.login?.toLowerCase() === user.name?.toLowerCase())
      ) {
        const [instRow] = await db.Installation.findOrCreate({
          where: { githubInstallationId: inst.id },
          defaults: {
            githubInstallationId: inst.id,
            accountLogin: inst.account.login,
            installedByUserId: user.id,
          },
        });
        if (instRow.installedByUserId !== user.id) {
          await instRow.update({ installedByUserId: user.id });
        }

        const octokit = await getInstallationOctokit(inst.id);
        const { data: repoData } = await octokit.request('GET /installation/repositories', {
          per_page: 100,
        });

        for (const repo of (repoData.repositories || [])) {
          await db.Repository.findOrCreate({
            where: { githubRepoId: repo.id },
            defaults: {
              installationId: instRow.id,
              githubRepoId: repo.id,
              fullName: repo.full_name,
              defaultBranch: repo.default_branch || 'main',
              isActive: true,
            },
          });
        }
      }
    }
  } catch (err) {
    logger.warn({ userId, err: err.message }, 'error syncing repositories with GitHub');
  }

  return listForUser(userId);
}

module.exports = { listForUser, getForUser, setActive, triggerReindex, resetIndex, syncForUser };

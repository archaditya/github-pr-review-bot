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

async function triggerReindex(userId, repositoryId) {
  const inngest = require('../jobs/client');
  const repository = await getForUser(userId, repositoryId);

  await repository.update({ indexStatus: 'INDEXING', indexError: null });

  const [owner, repoName] = repository.fullName.split('/');
  await inngest.send({
    name: 'repo/index.requested',
    data: {
      repositoryId: repository.id,
      installationId: repository.installation.githubInstallationId,
      owner,
      repo: repoName,
      branch: repository.defaultBranch || 'main',
    },
  });

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

module.exports = { listForUser, getForUser, setActive, triggerReindex, resetIndex };

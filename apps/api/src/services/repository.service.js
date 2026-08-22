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
 * Toggles whether the bot reviews PRs on this repo — lets a user pause reviews without
 * uninstalling the GitHub App entirely (docs/architecture/data-model.md).
 */
async function setActive(userId, repositoryId, isActive) {
  const repository = await getForUser(userId, repositoryId);
  await repository.update({ isActive });
  return repository;
}

module.exports = { listForUser, getForUser, setActive };

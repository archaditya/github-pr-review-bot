const { Op } = require('sequelize');
const db = require('../models');
const { NotFoundError, ForbiddenError } = require('../utils/errors');
const repositoryService = require('./repository.service');

/**
 * Cursor-paginated by createdAt (not by id — UUIDs aren't sequential, so an id-based
 * cursor wouldn't give a stable chronological order). `cursor` is the ISO timestamp of
 * the last item the caller saw.
 */
async function listForRepository(userId, repositoryId, { limit = 20, cursor } = {}) {
  // Reuses repository.service.js's ownership check — a user can't list jobs for a repo
  // they don't have access to.
  await repositoryService.getForUser(userId, repositoryId);

  const where = cursor ? { createdAt: { [Op.lt]: new Date(cursor) } } : {};

  return db.ReviewJob.findAll({
    where,
    include: [
      {
        model: db.PullRequest,
        as: 'pullRequest',
        where: { repositoryId },
        attributes: ['id', 'githubPrNumber', 'title', 'authorLogin'],
      },
    ],
    order: [['createdAt', 'DESC']],
    limit,
  });
}

/**
 * Full detail for one job — summary comment, conversation thread, and the JobEvent audit
 * trail (used by the "why did this review fail" runbook flow).
 */
async function getById(userId, reviewJobId) {
  const job = await db.ReviewJob.findByPk(reviewJobId, {
    include: [
      {
        model: db.PullRequest,
        as: 'pullRequest',
        include: [
          {
            model: db.Repository,
            as: 'repository',
            include: [{ model: db.Installation, as: 'installation' }],
          },
        ],
      },
      { model: db.ReviewComment, as: 'summaryComment' },
      { model: db.ConversationMessage, as: 'conversationMessages' },
      { model: db.JobEvent, as: 'events' },
    ],
    order: [
      [{ model: db.ConversationMessage, as: 'conversationMessages' }, 'createdAt', 'ASC'],
      [{ model: db.JobEvent, as: 'events' }, 'createdAt', 'ASC'],
    ],
  });

  if (!job) throw new NotFoundError('Review job not found');

  const ownerId = job.pullRequest.repository.installation.installedByUserId;
  if (ownerId !== userId) {
    throw new ForbiddenError('You do not have access to this review job');
  }

  return job;
}

module.exports = { listForRepository, getById };

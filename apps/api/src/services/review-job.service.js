const { Op } = require('sequelize');
const db = require('../models');
const { NotFoundError, ForbiddenError } = require('../utils/errors');
const repositoryService = require('./repository.service');
const eventBus = require('./event-bus.service');
const inngest = require('../jobs/client');
const { REVIEW_JOB_STATUSES } = require('../constants/review-job-status');
const logger = require('../utils/logger');

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

/**
 * Cancel a stuck or running review job.
 */
async function cancelJob(userId, reviewJobId) {
  const job = await getById(userId, reviewJobId);

  await job.update({
    status: REVIEW_JOB_STATUSES.FAILED,
    error: 'Cancelled by user',
    completedAt: new Date(),
  });

  await db.JobEvent.create({
    reviewJobId,
    step: 'cancelled_by_user',
    status: 'failed',
    detail: { cancelledBy: userId },
  });

  eventBus.emitReviewStatusChange({
    reviewJobId,
    status: REVIEW_JOB_STATUSES.FAILED,
    step: 'cancelled_by_user',
    error: 'Cancelled by user',
  });

  logger.info({ reviewJobId }, 'review job cancelled by user');
  return job;
}

/**
 * Delete a review job and its associated events/comments.
 */
async function deleteJob(userId, reviewJobId) {
  const job = await getById(userId, reviewJobId);
  await job.destroy();
  logger.info({ reviewJobId }, 'review job deleted by user');
  return { id: reviewJobId, deleted: true };
}

/**
 * Re-trigger / retry an existing review job.
 */
async function retryJob(userId, reviewJobId) {
  const job = await getById(userId, reviewJobId);
  const pr = job.pullRequest;
  const repo = pr.repository;
  const installation = repo.installation;

  // Reset status to PENDING
  await job.update({
    status: REVIEW_JOB_STATUSES.PENDING,
    error: null,
    startedAt: null,
    completedAt: null,
    attemptCount: job.attemptCount + 1,
  });

  eventBus.emitReviewStatusChange({
    reviewJobId,
    status: REVIEW_JOB_STATUSES.PENDING,
    step: 'retried_by_user',
  });

  const [owner, repoName] = repo.fullName.split('/');

  // Dispatch Inngest review pipeline event
  await inngest.send({
    name: 'pr/review.requested',
    data: {
      reviewJobId: job.id,
      installationId: installation.githubInstallationId,
      owner,
      repo: repoName,
      pullNumber: pr.githubPrNumber,
    },
  });

  logger.info({ reviewJobId }, 'review job re-triggered by user');
  return job;
}

module.exports = { listForRepository, getById, cancelJob, deleteJob, retryJob };

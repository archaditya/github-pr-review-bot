const inngest = require('./client');
const reviewService = require('../services/review.service');
const { REVIEW_JOB_STATUSES } = require('../constants/review-job-status');

/**
 * Triggered by `pr/review.requested` (emitted from services/webhook.service.js). Each
 * step is independently retried by Inngest without re-running earlier, already-succeeded
 * steps (ADR-005). Every step also moves the ReviewJob through its state machine
 * (docs/architecture/data-model.md) so progress is visible on the `web` dashboard.
 */
const reviewPipeline = inngest.createFunction(
  { id: 'review-pipeline', retries: 3 },
  { event: 'pr/review.requested' },
  async ({ event, step }) => {
    const { reviewJobId, installationId, owner, repo, pullNumber } = event.data;

    const { diff, changedFiles } = await step.run('fetch-diff', async () => {
      await reviewService.transitionStatus(reviewJobId, REVIEW_JOB_STATUSES.FETCHING_DIFF, {
        step: 'fetch_diff',
      });
      return reviewService.fetchDiffContext({ installationId, owner, repo, pullNumber });
    });

    const usageContext = await step.run('resolve-usages', async () => {
      await reviewService.transitionStatus(reviewJobId, REVIEW_JOB_STATUSES.RESOLVING_USAGES, {
        step: 'resolve_usages',
      });
      return reviewService.resolveUsageContext(changedFiles);
    });

    const findings = await step.run('generate-review', async () => {
      await reviewService.transitionStatus(reviewJobId, REVIEW_JOB_STATUSES.GENERATING_REVIEW, {
        step: 'generate_review',
      });
      return reviewService.generateFindings({
        diff,
        usageContext,
        pr: { owner, repo, number: pullNumber },
      });
    });

    await step.run('post-comment', async () => {
      await reviewService.transitionStatus(reviewJobId, REVIEW_JOB_STATUSES.POSTING_COMMENTS, {
        step: 'post_comment',
      });
      return reviewService.postSummaryAndPersist({
        reviewJobId,
        installationId,
        owner,
        repo,
        pullNumber,
        findings,
      });
    });

    await reviewService.transitionStatus(reviewJobId, REVIEW_JOB_STATUSES.COMPLETED, {
      step: 'complete',
      detail: { findingsCount: findings.length },
    });

    return { reviewJobId, findingsCount: findings.length };
  },
);

module.exports = reviewPipeline;

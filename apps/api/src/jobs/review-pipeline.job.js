const inngest = require('./client');
const reviewService = require('../services/review.service');
const { REVIEW_JOB_STATUSES } = require('../constants/review-job-status');
const impactQueries = require('../integrations/neo4j/impact-queries');
const db = require('../models');
const logger = require('../utils/logger');

/**
 * Triggered by `pr/review.requested` (emitted from services/webhook.service.js). Each
 * step is independently retried by Inngest without re-running earlier, already-succeeded
 * steps (ADR-005). Every step also moves the ReviewJob through its state machine
 * so progress and failures are visible in real-time on the dashboard.
 *
 * Pipeline steps:
 *   1. fetch-diff       — get unified diff + changed files list from GitHub
 *   2. analyze-impact   — query Neo4j code knowledge graph for blast radius
 *   3. build-context    — assemble rich context for the LLM
 *   4. generate-review  — call ai-service with diff + structural impact
 *   5. post-comment     — post findings as a GitHub PR comment
 */
const reviewPipeline = inngest.createFunction(
  {
    id: 'review-pipeline',
    retries: 2,
    onFailure: async ({ event, error }) => {
      const reviewJobId = event.data?.event?.data?.reviewJobId || event.data?.reviewJobId;
      if (reviewJobId) {
        logger.error({ reviewJobId, err: error?.message }, 'review pipeline failed — updating status to FAILED');
        try {
          await reviewService.transitionStatus(reviewJobId, REVIEW_JOB_STATUSES.FAILED, {
            error: error?.message || 'Review pipeline failed unexpectedly',
            step: 'pipeline_failed',
            detail: { error: error?.message },
          });
        } catch (updateErr) {
          logger.error({ updateErr }, 'failed to update review job to FAILED');
        }
      }
    },
  },
  { event: 'pr/review.requested' },
  async ({ event, step }) => {
    const { reviewJobId, installationId, owner, repo, pullNumber } = event.data;

    let diff, changedFiles;
    try {
      const diffData = await step.run('fetch-diff', async () => {
        await reviewService.transitionStatus(reviewJobId, REVIEW_JOB_STATUSES.FETCHING_DIFF, {
          step: 'fetch_diff',
        });
        return reviewService.fetchDiffContext({ installationId, owner, repo, pullNumber });
      });
      diff = diffData.diff;
      changedFiles = diffData.changedFiles;
    } catch (err) {
      await reviewService.transitionStatus(reviewJobId, REVIEW_JOB_STATUSES.FAILED, {
        error: `Failed to fetch diff: ${err.message}`,
        step: 'fetch_diff',
      });
      throw err;
    }

    // Graph impact analysis — gracefully degrades if repo isn't indexed
    let impactContext = null;
    try {
      impactContext = await step.run('analyze-impact', async () => {
        await reviewService.transitionStatus(reviewJobId, REVIEW_JOB_STATUSES.ANALYZING_IMPACT, {
          step: 'analyze_impact',
        });

        // Find the repository to get its ID for graph queries
        const repository = await db.Repository.findOne({
          include: [{ model: db.Installation, as: 'installation', where: { githubInstallationId: installationId } }],
          where: { fullName: `${owner}/${repo}` },
        });

        if (!repository || repository.indexStatus !== 'INDEXED') {
          logger.info({ reviewJobId }, 'repo not indexed — skipping graph impact analysis');
          return null;
        }

        const hasGraphData = await impactQueries.hasGraph(repository.id);
        if (!hasGraphData) return null;

        const changedPaths = changedFiles.map((f) => f.filename);
        const impact = await impactQueries.analyzeImpact(repository.id, changedPaths);

        return {
          changed_symbols: impact.changedSymbols,
          callers: impact.callers,
          callees: impact.callees,
          affected_endpoints: impact.affectedEndpoints,
          related_tests: impact.relatedTests,
          affected_files_count: impact.affectedFilesCount,
        };
      });
    } catch (err) {
      logger.warn({ reviewJobId, err: err.message }, 'impact analysis step error — falling back to standard review');
      impactContext = null;
    }

    let usageContext;
    try {
      usageContext = await step.run('build-context', async () => {
        await reviewService.transitionStatus(reviewJobId, REVIEW_JOB_STATUSES.BUILDING_CONTEXT, {
          step: 'build_context',
        });
        return reviewService.resolveUsageContext(changedFiles);
      });
    } catch (err) {
      await reviewService.transitionStatus(reviewJobId, REVIEW_JOB_STATUSES.FAILED, {
        error: `Failed to build context: ${err.message}`,
        step: 'build_context',
      });
      throw err;
    }

    let findings;
    try {
      findings = await step.run('generate-review', async () => {
        await reviewService.transitionStatus(reviewJobId, REVIEW_JOB_STATUSES.GENERATING_REVIEW, {
          step: 'generate_review',
        });
        return reviewService.generateFindings({
          diff,
          usageContext,
          impactContext,
          pr: { owner, repo, number: pullNumber },
        });
      });
    } catch (err) {
      await reviewService.transitionStatus(reviewJobId, REVIEW_JOB_STATUSES.FAILED, {
        error: `Failed to generate review: ${err.message}`,
        step: 'generate_review',
      });
      throw err;
    }

    try {
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
    } catch (err) {
      await reviewService.transitionStatus(reviewJobId, REVIEW_JOB_STATUSES.FAILED, {
        error: `Failed to post GitHub comment: ${err.message}`,
        step: 'post_comment',
      });
      throw err;
    }

    await reviewService.transitionStatus(reviewJobId, REVIEW_JOB_STATUSES.COMPLETED, {
      step: 'complete',
      detail: {
        findingsCount: findings.length,
        hadGraphContext: !!impactContext,
      },
    });

    return { reviewJobId, findingsCount: findings.length, hadGraphContext: !!impactContext };
  },
);

module.exports = reviewPipeline;

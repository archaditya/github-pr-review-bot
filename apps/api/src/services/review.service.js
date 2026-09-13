const db = require('../models');
const config = require('../config');
const { REVIEW_JOB_STATUSES } = require('../constants/review-job-status');
const githubPr = require('../integrations/github/pull-request-client');
const githubComments = require('../integrations/github/comment-client');
const aiService = require('../integrations/ai-service-client');
const eventBus = require('./event-bus.service');

/**
 * Moves a ReviewJob to `status` (guarded by the model hook in models/review-job.model.js)
 * and appends a JobEvent row for the audit trail (docs/architecture/data-model.md).
 * Called from each Inngest step in jobs/review-pipeline.job.js.
 */
async function transitionStatus(reviewJobId, status, { error, detail, step } = {}) {
  const reviewJob = await db.ReviewJob.findByPk(reviewJobId);
  if (!reviewJob) throw new Error(`ReviewJob ${reviewJobId} not found`);

  const patch = { status };
  if (status === REVIEW_JOB_STATUSES.FETCHING_DIFF && !reviewJob.startedAt) {
    patch.startedAt = new Date();
  }
  if ([REVIEW_JOB_STATUSES.COMPLETED, REVIEW_JOB_STATUSES.FAILED].includes(status)) {
    patch.completedAt = new Date();
  }
  if (error) patch.error = error;

  await reviewJob.update(patch);

  const eventStep = step || status.toLowerCase();

  // Avoid creating duplicate identical succeeded/in-progress events if Inngest retried the same step
  const lastEvent = await db.JobEvent.findOne({
    where: { reviewJobId },
    order: [['createdAt', 'DESC']],
  });

  if (!lastEvent || lastEvent.step !== eventStep || error) {
    await db.JobEvent.create({
      reviewJobId,
      step: eventStep,
      status: error ? 'failed' : 'succeeded',
      detail: detail || null,
    });
  } else if (detail) {
    // If re-entering with new detail, update the last event
    await lastEvent.update({ detail });
  }

  // Emit real-time event for WebSocket broadcast
  eventBus.emitReviewStatusChange({
    reviewJobId,
    status,
    step: eventStep,
    detail: detail || null,
  });

  return reviewJob;
}

async function fetchDiffContext({ installationId, owner, repo, pullNumber }) {
  const [diff, changedFiles] = await Promise.all([
    githubPr.getPullRequestDiff({ installationId, owner, repo, pullNumber }),
    githubPr.listChangedFiles({ installationId, owner, repo, pullNumber }),
  ]);
  return { diff, changedFiles };
}

/**
 * Best-effort same-repo usage resolution (PRD core user story / ADR-003). MVP: reasons
 * only over the diff hunks GitHub already gives us per changed file. A full implementation
 * would check out the repo and grep/AST-scan the whole tree for call sites outside the
 * diff — tracked as a known MVP limitation, see docs/architecture/data-model.md.
 */
const IGNORED_LOCKFILES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'cargo.lock',
  'poetry.lock',
  'composer.lock',
  'gemfile.lock',
];

function resolveUsageContext(changedFiles) {
  if (!Array.isArray(changedFiles)) return [];
  return changedFiles.map((file) => {
    const filename = file.filename || file.file || 'unknown';
    const isLockfile = IGNORED_LOCKFILES.some((p) => filename.toLowerCase().endsWith(p));
    return {
      file: filename,
      status: file.status || 'modified',
      patch: isLockfile ? '' : (typeof file.patch === 'string' ? file.patch : ''),
    };
  });
}

async function generateFindings({ diff, usageContext, impactContext, pr }) {
  const reviewContext = {
    diff: typeof diff === 'string' ? diff : (diff ? JSON.stringify(diff) : ''),
    usage_context: Array.isArray(usageContext) ? usageContext : [],
    pull_request: {
      owner: String(pr?.owner || ''),
      repo: String(pr?.repo || ''),
      number: Number(pr?.number || 0),
    },
  };

  // Attach structural impact context when available (from code knowledge graph)
  if (impactContext) {
    reviewContext.impact_context = impactContext;
  }

  const result = await aiService.generateReview(reviewContext);
  return result.findings || [];
}

function renderSummaryBody(findings, { reviewJobId } = {}) {
  if (!findings || findings.length === 0) {
    return '### AI Review Summary\n\nNo issues found.';
  }

  const lines = findings.map((f) => {
    let line = `- **${f.severity || 'info'}** \`${f.file}:${f.line}\` — ${f.rationale}`;
    if (f.evidence) {
      line += `\n  > _Evidence: ${f.evidence}_`;
    }
    return line;
  });

  const dashboardUrl = config.webAppUrl || 'https://pr-review-bot.archadi.dev';
  const jobPath = reviewJobId ? `/review-jobs/${reviewJobId}` : '';

  const parts = [
    '### AI Review Summary',
    '',
    ...lines,
    '',
    `_Reply with @${config.github.botHandle} to ask about this review._`,
  ];

  // Add deep-links to dashboard actions
  if (reviewJobId) {
    parts.push(
      '',
      '---',
      `[🔀 Merge PR →](${dashboardUrl}${jobPath}?action=merge)  |  [📝 Make Post →](${dashboardUrl}${jobPath}?action=post)`,
    );
  }

  return parts.join('\n');
}

async function postSummaryAndPersist({
  reviewJobId,
  installationId,
  owner,
  repo,
  pullNumber,
  findings,
}) {
  const body = renderSummaryBody(findings, { reviewJobId });
  const posted = await githubComments.postSummaryComment({
    installationId,
    owner,
    repo,
    pullNumber,
    body,
  });

  await db.ReviewComment.create({
    reviewJobId,
    body,
    githubCommentId: posted.id,
    findings,
  });

  return posted;
}

module.exports = {
  transitionStatus,
  fetchDiffContext,
  resolveUsageContext,
  generateFindings,
  renderSummaryBody,
  postSummaryAndPersist,
};

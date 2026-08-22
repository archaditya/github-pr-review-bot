const db = require('../models');
const config = require('../config');
const { REVIEW_JOB_STATUSES } = require('../constants/review-job-status');
const githubPr = require('../integrations/github/pull-request-client');
const githubComments = require('../integrations/github/comment-client');
const aiService = require('../integrations/ai-service-client');

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

  await db.JobEvent.create({
    reviewJobId,
    step: step || status.toLowerCase(),
    status: error ? 'failed' : 'succeeded',
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
function resolveUsageContext(changedFiles) {
  return changedFiles.map((file) => ({
    file: file.filename,
    status: file.status,
    patch: file.patch || '',
  }));
}

async function generateFindings({ diff, usageContext, pr }) {
  const reviewContext = {
    diff,
    usage_context: usageContext,
    pull_request: pr,
  };
  const result = await aiService.generateReview(reviewContext);
  return result.findings || [];
}

function renderSummaryBody(findings) {
  if (!findings || findings.length === 0) {
    return '### AI Review Summary\n\nNo issues found.';
  }

  const lines = findings.map(
    (f) => `- **${f.severity || 'info'}** \`${f.file}:${f.line}\` — ${f.rationale}`,
  );

  return [
    '### AI Review Summary',
    '',
    ...lines,
    '',
    `_Reply with @${config.github.botHandle} to ask about this review._`,
  ].join('\n');
}

async function postSummaryAndPersist({
  reviewJobId,
  installationId,
  owner,
  repo,
  pullNumber,
  findings,
}) {
  const body = renderSummaryBody(findings);
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

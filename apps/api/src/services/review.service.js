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

function formatFindingLine(f) {
  let line = `- **${f.severity || 'info'}** \`${f.file}${f.line ? `:${f.line}` : ''}\` — ${f.rationale}`;
  if (f.evidence) {
    line += `\n  > _Evidence: ${f.evidence}_`;
  }
  return line;
}

function renderSummaryBody(findings, { reviewJobId } = {}) {
  const dashboardUrl = config.webAppUrl || 'https://pr-review-bot.archadi.dev';
  const jobPath = reviewJobId ? `/review-jobs/${reviewJobId}` : '';
  const actionLinks = reviewJobId
    ? ['', '---', `[🔀 Merge PR →](${dashboardUrl}${jobPath}?action=merge)  |  [📝 Make Post →](${dashboardUrl}${jobPath}?action=post)`]
    : [];

  // Case 1: Clean code — zero findings
  if (!findings || findings.length === 0) {
    return [
      '### ✅ AI Review: Approved (LGTM)',
      '',
      '**Status:** Ready to merge 🚀',
      '',
      'No issues, bugs, or security vulnerabilities found. The implementation is clean and well-structured!',
      '',
      `_Reply with @${config.github.botHandle} if you have any questions._`,
      ...actionLinks,
    ].join('\n');
  }

  const blockers = findings.filter((f) => ['critical', 'high'].includes(f.severity));
  const warnings = findings.filter((f) => f.severity === 'medium');
  const suggestions = findings.filter((f) => ['low', 'info'].includes(f.severity) || !f.severity);

  const parts = [];

  if (blockers.length === 0 && warnings.length === 0) {
    // Case 2: Only non-blocking suggestions / info
    parts.push(
      '### ✅ AI Review: Approved with Suggestions (LGTM)',
      '',
      '**Status:** Ready to merge 🚀 *(all findings below are optional / non-blocking)*',
      '',
      'The core implementation is solid. Here are a few minor ideas or non-blocking observations for consideration:',
      '',
      '#### 💡 Suggestions & Notes',
      ...suggestions.map(formatFindingLine),
    );
  } else if (blockers.length === 0) {
    // Case 3: Medium considerations but no blockers
    parts.push(
      '### ⚠️ AI Review: Looks Good, Minor Considerations',
      '',
      "**Status:** Mergeable at author's discretion 👍 *(no critical/high blockers)*",
      '',
      '#### 🔍 Discussion Points',
      ...warnings.map(formatFindingLine),
    );
    if (suggestions.length > 0) {
      parts.push('', '#### 💡 Suggestions & Notes', ...suggestions.map(formatFindingLine));
    }
  } else {
    // Case 4: Critical or high blockers present
    parts.push(
      '### 🛑 AI Review: Action Suggested',
      '',
      '**Status:** Potential blocking issues detected ⚠️',
      '',
      '#### 🚨 Issues to Address',
      ...blockers.map(formatFindingLine),
    );
    if (warnings.length > 0) {
      parts.push('', '#### 🔍 Discussion Points', ...warnings.map(formatFindingLine));
    }
    if (suggestions.length > 0) {
      parts.push('', '#### 💡 Non-blocking Suggestions', ...suggestions.map(formatFindingLine));
    }
  }

  parts.push(
    '',
    `_Reply with @${config.github.botHandle} to ask about this review._`,
    ...actionLinks,
  );

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

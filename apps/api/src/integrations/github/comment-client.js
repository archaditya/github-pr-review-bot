const { getInstallationOctokit } = require('./app-auth');

/**
 * Posts the single summary comment for a review (ADR-009). Uses the Issues API since
 * the comment isn't tied to a specific diff line. Returns the created comment (its `id`
 * is persisted as ReviewComment.githubCommentId).
 */
async function postSummaryComment({ installationId, owner, repo, pullNumber, body }) {
  const octokit = await getInstallationOctokit(installationId);
  const { data } = await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: pullNumber,
    body,
  });
  return data;
}

/**
 * Posts a conversational reply. Still the Issues API — GitHub gives no native threading
 * here (ADR-009), so the caller (ai-service's conversation agent) writes the body to read
 * as a direct response rather than relying on structural nesting.
 */
async function postReplyComment({ installationId, owner, repo, pullNumber, body }) {
  return postSummaryComment({ installationId, owner, repo, pullNumber, body });
}

module.exports = { postSummaryComment, postReplyComment };

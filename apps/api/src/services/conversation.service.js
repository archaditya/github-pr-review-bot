const config = require('../config');

/**
 * MVP trigger rule for "is this PR comment meant for the bot" (ADR-009, D4): @mention-only.
 * No time-window or comment-ordering heuristic — unambiguous, needs no tuning. Isolated
 * here so the rule can be relaxed later without touching webhook plumbing.
 */
function isDirectedAtBot(commentBody) {
  if (!commentBody) return false;
  const mention = `@${config.github.botHandle}`.toLowerCase();
  return commentBody.toLowerCase().includes(mention);
}

module.exports = { isDirectedAtBot };

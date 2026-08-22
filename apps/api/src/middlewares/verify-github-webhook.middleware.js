const config = require('../config');
const { verifySignature } = require('../integrations/github/webhook-verifier');
const { UnauthorizedError } = require('../utils/errors');

/**
 * Verifies X-Hub-Signature-256 before the webhook payload is trusted (ADR-007). Mounted
 * only on the GitHub webhook route — never on user-facing routes, which use
 * middlewares/auth.middleware.js instead.
 */
function verifyGithubWebhook(req, res, next) {
  if (!req.rawBody) {
    // Should never happen if app.js's express.json() verify option is intact — fail loudly.
    return next(new Error('Raw request body was not captured for signature verification'));
  }

  const signature = req.headers['x-hub-signature-256'];
  const valid = verifySignature(req.rawBody, signature, config.github.webhookSecret);

  if (!valid) {
    req.log?.warn({ event: req.headers['x-github-event'] }, 'rejected webhook: bad signature');
    return next(new UnauthorizedError('Invalid GitHub webhook signature'));
  }

  return next();
}

module.exports = verifyGithubWebhook;

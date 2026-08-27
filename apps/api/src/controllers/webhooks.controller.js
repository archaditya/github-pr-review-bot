const webhookService = require('../services/webhook.service');

const HANDLERS = {
  pull_request: webhookService.handlePullRequestEvent,
  issue_comment: webhookService.handleIssueCommentEvent,
  installation_repositories: webhookService.handleInstallationRepositoriesEvent,
  installation: webhookService.handleInstallationEvent,
  push: webhookService.handlePushEvent,
};

/**
 * Single entrypoint for all GitHub webhook events. Signature already verified by
 * middlewares/verify-github-webhook.middleware.js before this runs. Does only the minimal
 * synchronous work needed to persist + enqueue (ADR-005) — GitHub expects a fast ack.
 */
async function handleGithubWebhook(req, res, next) {
  try {
    const event = req.headers['x-github-event'];
    const handler = HANDLERS[event];

    if (!handler) {
      req.log.info({ event }, 'ignoring unhandled github event type');
      return res.status(202).json({ received: true, handled: false });
    }

    await handler(req.body);
    return res.status(202).json({ received: true, handled: true });
  } catch (err) {
    return next(err);
  }
}

module.exports = { handleGithubWebhook };

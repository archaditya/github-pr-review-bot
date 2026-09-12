const db = require('../models');
const config = require('../config');
const { NotFoundError } = require('../utils/errors');
const githubPr = require('../integrations/github/pull-request-client');
const repositoryService = require('./repository.service');
const logger = require('../utils/logger');

/**
 * Merge a pull request via the GitHub API.
 * Uses the bot's existing GitHub App installation credentials.
 */
async function mergePullRequest(userId, pullRequestId, { mergeMethod = 'merge' } = {}) {
  const pr = await db.PullRequest.findByPk(pullRequestId, {
    include: [
      {
        model: db.Repository,
        as: 'repository',
        include: [{ model: db.Installation, as: 'installation' }],
      },
    ],
  });

  if (!pr) throw new NotFoundError('Pull request not found');
  await repositoryService.getForUser(userId, pr.repository.id);

  const installation = pr.repository.installation;
  const [owner, repo] = pr.repository.fullName.split('/');

  const result = await githubPr.mergePullRequest({
    installationId: installation.githubInstallationId,
    owner,
    repo,
    pullNumber: pr.githubPrNumber,
    mergeMethod,
  });

  logger.info(
    { pullRequestId, prNumber: pr.githubPrNumber, repo: pr.repository.fullName },
    'PR merged via dashboard',
  );

  return {
    merged: result.merged,
    sha: result.sha,
    message: result.message,
  };
}

module.exports = { mergePullRequest };

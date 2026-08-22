const { getInstallationOctokit } = require('./app-auth');

/**
 * PR metadata (title, head/base SHA, author) — used when a webhook only gives us IDs
 * and we need the full picture (e.g. reopened events after a long gap).
 */
async function getPullRequest({ installationId, owner, repo, pullNumber }) {
  const octokit = await getInstallationOctokit(installationId);
  const { data } = await octokit.rest.pulls.get({ owner, repo, pull_number: pullNumber });
  return data;
}

/**
 * Raw unified diff for the PR — fed into the usage-resolution step and then into
 * ai-service's ReviewContext (docs/architecture/data-model.md).
 */
async function getPullRequestDiff({ installationId, owner, repo, pullNumber }) {
  const octokit = await getInstallationOctokit(installationId);
  const { data } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
    mediaType: { format: 'diff' },
  });
  return data; // raw diff text (octokit returns it as a string when format: 'diff')
}

/**
 * Per-file change list (used to scope the symbol-usage grep/AST pass to just the
 * changed files, ADR-003 § usage resolution).
 */
async function listChangedFiles({ installationId, owner, repo, pullNumber }) {
  const octokit = await getInstallationOctokit(installationId);
  return octokit.paginate(octokit.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });
}

module.exports = { getPullRequest, getPullRequestDiff, listChangedFiles };

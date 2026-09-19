const { getInstallationOctokit } = require('./app-auth');

/**
 * PR metadata (title, head/base SHA, author) — used when a webhook only gives us IDs
 * and we need the full picture (e.g. reopened events after a long gap).
 */
async function getPullRequest({ installationId, owner, repo, pullNumber }) {
  const octokit = await getInstallationOctokit(installationId);
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
    owner,
    repo,
    pull_number: pullNumber,
  });
  return data;
}

/**
 * Raw unified diff for the PR — fed into the usage-resolution step and then into
 * ai-service's ReviewContext (docs/architecture/data-model.md).
 */
async function getPullRequestDiff({ installationId, owner, repo, pullNumber }) {
  const octokit = await getInstallationOctokit(installationId);
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
    owner,
    repo,
    pull_number: pullNumber,
    headers: {
      accept: 'application/vnd.github.v3.diff',
    },
  });
  return data; // raw diff text (octokit returns it as a string when diff header is used)
}

/**
 * Per-file change list (used to scope the symbol-usage grep/AST pass to just the
 * changed files, ADR-003 § usage resolution).
 */
async function listChangedFiles({ installationId, owner, repo, pullNumber }) {
  const octokit = await getInstallationOctokit(installationId);
  // Paginate through all changed files (up to 500 files)
  const files = await octokit.paginate(
    'GET /repos/{owner}/{repo}/pulls/{pull_number}/files',
    {
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    },
    (response, done) => {
      if (response.data.length >= 500) {
        done();
      }
      return response.data;
    },
  );
  return files || [];
}

/**
 * Merge a pull request via the GitHub API.
 * Requires the GitHub App to have `contents: write` permission.
 */
async function mergePullRequest({ installationId, owner, repo, pullNumber, mergeMethod = 'merge' }) {
  const octokit = await getInstallationOctokit(installationId);
  const { data } = await octokit.request('PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge', {
    owner,
    repo,
    pull_number: pullNumber,
    merge_method: mergeMethod,
  });
  return data;
}

module.exports = { getPullRequest, getPullRequestDiff, listChangedFiles, mergePullRequest };

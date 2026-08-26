const config = require('../../config');
const logger = require('../../utils/logger');

const INDEXER_BASE_URL = config.indexerServiceUrl || 'http://indexer-service:8001';
const TIMEOUT_MS = 120_000; // 2 minutes — full indexing can take time

/**
 * Call the indexer service to perform a full repository index.
 */
async function requestFullIndex({ repoId, owner, repo, token, branch = 'main' }) {
  const url = `${INDEXER_BASE_URL}/index/full`;
  logger.info({ repoId, owner, repo }, 'requesting full index');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_id: repoId,
      owner,
      repo,
      token,
      branch,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`indexer-service full index failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Call the indexer service to perform an incremental index update.
 */
async function requestIncrementalIndex({ repoId, owner, repo, token, branch = 'main', changedFiles = null }) {
  const url = `${INDEXER_BASE_URL}/index/incremental`;
  logger.info({ repoId, owner, repo, changedFileCount: changedFiles?.length }, 'requesting incremental index');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_id: repoId,
      owner,
      repo,
      token,
      branch,
      changed_files: changedFiles,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`indexer-service incremental index failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Get graph stats for a repository.
 */
async function getIndexStatus(repoId) {
  const url = `${INDEXER_BASE_URL}/index/status/${repoId}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });

  if (!res.ok) {
    throw new Error(`indexer-service status check failed (${res.status})`);
  }

  return res.json();
}

module.exports = { requestFullIndex, requestIncrementalIndex, getIndexStatus };

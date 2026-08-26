const inngest = require('./client');
const indexerClient = require('../integrations/indexer-service-client');
const { getInstallationToken } = require('../integrations/github/app-auth');
const db = require('../models');
const logger = require('../utils/logger');

/**
 * Full repository indexing job.
 * Triggered when a repository is first connected via GitHub App installation.
 * Calls the indexer-service to clone, parse, and build the code knowledge graph.
 */
const indexRepository = inngest.createFunction(
  { id: 'index-repository', retries: 2 },
  { event: 'repo/index.requested' },
  async ({ event, step }) => {
    const { repositoryId, installationId, owner, repo, branch } = event.data;

    await step.run('set-indexing-status', async () => {
      await db.Repository.update(
        { indexStatus: 'INDEXING', indexError: null },
        { where: { id: repositoryId } },
      );
    });

    const result = await step.run('run-full-index', async () => {
      const token = await getInstallationToken(installationId);

      return indexerClient.requestFullIndex({
        repoId: repositoryId,
        owner,
        repo,
        token,
        branch,
      });
    });

    await step.run('update-index-status', async () => {
      await db.Repository.update(
        {
          indexStatus: 'INDEXED',
          indexedCommitSha: result.commit_sha,
          indexedAt: new Date(),
          fileCount: result.file_count || 0,
          symbolCount: result.symbol_count || 0,
          indexError: null,
        },
        { where: { id: repositoryId } },
      );

      logger.info(
        { repositoryId, commitSha: result.commit_sha, files: result.file_count, symbols: result.symbol_count },
        'repository indexed successfully',
      );
    });

    return { repositoryId, ...result };
  },
);

module.exports = indexRepository;

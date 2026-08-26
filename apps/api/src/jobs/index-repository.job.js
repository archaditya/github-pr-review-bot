const inngest = require('./client');
const indexerClient = require('../integrations/indexer-service-client');
const { getInstallationToken } = require('../integrations/github/app-auth');
const eventBus = require('../services/event-bus.service');
const db = require('../models');
const logger = require('../utils/logger');

/**
 * Full repository indexing job.
 * Triggered when a repository is first connected via GitHub App installation or manually via UI.
 * Calls the indexer-service to clone, parse, and build the code knowledge graph.
 */
const indexRepository = inngest.createFunction(
  {
    id: 'index-repository',
    retries: 2,
    onFailure: async ({ event, error }) => {
      const repositoryId = event.data?.event?.data?.repositoryId || event.data?.repositoryId;
      if (repositoryId) {
        logger.error({ repositoryId, err: error?.message }, 'repository indexing failed');
        await db.Repository.update(
          { indexStatus: 'FAILED', indexError: error?.message || 'Indexing failed' },
          { where: { id: repositoryId } },
        );
        eventBus.emitIndexError({ repositoryId, error: error?.message });
        eventBus.emitIndexStatusChange({ repositoryId, indexStatus: 'FAILED' });
      }
    },
  },
  { event: 'repo/index.requested' },
  async ({ event, step }) => {
    const { repositoryId, installationId, owner, repo, branch } = event.data;

    await step.run('set-indexing-status', async () => {
      await db.Repository.update(
        { indexStatus: 'INDEXING', indexError: null },
        { where: { id: repositoryId } },
      );
      eventBus.emitIndexStatusChange({ repositoryId, indexStatus: 'INDEXING' });
    });

    let result;
    try {
      result = await step.run('run-full-index', async () => {
        const token = await getInstallationToken(installationId);

        return indexerClient.requestFullIndex({
          repoId: repositoryId,
          owner,
          repo,
          token,
          branch,
        });
      });
    } catch (err) {
      await db.Repository.update(
        { indexStatus: 'FAILED', indexError: err.message },
        { where: { id: repositoryId } },
      );
      eventBus.emitIndexError({ repositoryId, error: err.message });
      eventBus.emitIndexStatusChange({ repositoryId, indexStatus: 'FAILED' });
      throw err;
    }

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

      eventBus.emitIndexStatusChange({
        repositoryId,
        indexStatus: 'INDEXED',
        fileCount: result.file_count || 0,
        symbolCount: result.symbol_count || 0,
      });

      logger.info(
        { repositoryId, commitSha: result.commit_sha, files: result.file_count, symbols: result.symbol_count },
        'repository indexed successfully',
      );
    });

    return { repositoryId, ...result };
  },
);

module.exports = indexRepository;

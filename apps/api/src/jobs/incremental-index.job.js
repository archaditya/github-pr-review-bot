const inngest = require('./client');
const indexerClient = require('../integrations/indexer-service-client');
const { getInstallationToken } = require('../integrations/github/app-auth');
const db = require('../models');
const logger = require('../utils/logger');

/**
 * Incremental index update job.
 * Triggered when a push to the default branch is detected (usually after PR merge).
 * Only re-processes changed files.
 */
const incrementalIndex = inngest.createFunction(
  { id: 'incremental-index', retries: 2 },
  { event: 'repo/push.default-branch' },
  async ({ event, step }) => {
    const { repositoryId, installationId, owner, repo, branch, changedFiles, headSha } = event.data;

    await step.run('set-reindexing-status', async () => {
      await db.Repository.update(
        { indexStatus: 'REINDEXING' },
        { where: { id: repositoryId } },
      );
    });

    const result = await step.run('run-incremental-index', async () => {
      const token = await getInstallationToken(installationId);

      return indexerClient.requestIncrementalIndex({
        repoId: repositoryId,
        owner,
        repo,
        token,
        branch,
        changedFiles,
      });
    });

    await step.run('update-index-status', async () => {
      await db.Repository.update(
        {
          indexStatus: 'INDEXED',
          indexedCommitSha: result.commit_sha || headSha,
          indexedAt: new Date(),
          fileCount: db.sequelize.literal(
            `file_count + ${(result.files_added || 0) - (result.files_deleted || 0)}`,
          ),
          symbolCount: result.symbol_count || 0,
          indexError: null,
        },
        { where: { id: repositoryId } },
      );

      logger.info(
        { repositoryId, added: result.files_added, modified: result.files_modified, deleted: result.files_deleted },
        'incremental index complete',
      );
    });

    return { repositoryId, ...result };
  },
);

module.exports = incrementalIndex;

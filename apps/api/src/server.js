const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const db = require('./models');

let server;

async function start() {
  // Fail fast if the DB isn't reachable — don't accept traffic against a broken connection.
  // Schema itself is owned entirely by migrations (ADR-004) — never db.sequelize.sync() here.
  await db.sequelize.authenticate();
  logger.info('database connection established');

  server = app.listen(config.port, () => {
    logger.info({ port: config.port, env: config.env }, 'api server listening');
  });
}

async function shutdown(signal) {
  logger.info({ signal }, 'shutting down');

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  await db.sequelize.close();
  logger.info('shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
  logger.fatal({ err }, 'unhandled promise rejection — exiting');
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaught exception — exiting');
  process.exit(1);
});

start().catch((err) => {
  logger.fatal({ err }, 'failed to start server');
  process.exit(1);
});

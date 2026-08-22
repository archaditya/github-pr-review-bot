const pino = require('pino');
const config = require('../config');

const logger = pino({
  level: config.logLevel,
  transport: config.isDevelopment
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
    : undefined,
  redact: {
    // never log secrets even if accidentally passed into a log call
    paths: [
      'req.headers.authorization',
      'config.auth.jwtSecret',
      'config.github.privateKey',
      'config.github.webhookSecret',
      '*.password',
      '*.token',
    ],
    censor: '[REDACTED]',
  },
  base: { service: 'api' },
});

module.exports = logger;

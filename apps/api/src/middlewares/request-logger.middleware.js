const pinoHttp = require('pino-http');
const { randomUUID } = require('crypto');
const logger = require('../utils/logger');

/**
 * Attaches req.log (child logger with a request id) and logs one line per request.
 * The request id is also echoed back as X-Request-Id so it can be correlated client-side.
 */
const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const existing = req.headers['x-request-id'];
    const id = existing || randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  // don't spam logs with health check polling
  autoLogging: {
    ignore: (req) => req.url === '/health' || req.url === '/health/ready',
  },
});

module.exports = requestLogger;

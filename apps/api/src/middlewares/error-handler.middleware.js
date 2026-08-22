const { AppError } = require('../utils/errors');
const config = require('../config');

/**
 * Single place every thrown/rejected error in the app funnels through. Controllers should
 * throw AppError subclasses (or let unexpected errors bubble) rather than shaping error
 * responses themselves — see src/controllers/README.md.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const isKnown = err instanceof AppError;

  const statusCode = isKnown ? err.statusCode : 500;
  const code = isKnown ? err.code : 'INTERNAL_ERROR';
  // Never leak internal error messages/stack traces for unexpected (non-operational) errors
  const message = isKnown ? err.message : 'Something went wrong';

  if (!isKnown || statusCode >= 500) {
    req.log?.error({ err }, 'unhandled error');
  } else {
    req.log?.warn({ err }, 'request error');
  }

  const body = {
    error: {
      code,
      message,
      ...(isKnown && err.details ? { details: err.details } : {}),
      requestId: req.id,
    },
  };

  if (!config.isProduction && !isKnown) {
    body.error.stack = err.stack;
  }

  res.status(statusCode).json(body);
}

module.exports = errorHandler;

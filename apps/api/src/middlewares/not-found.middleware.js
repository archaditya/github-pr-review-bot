const { NotFoundError } = require('../utils/errors');

function notFoundHandler(req, res, next) {
  next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`));
}

module.exports = notFoundHandler;

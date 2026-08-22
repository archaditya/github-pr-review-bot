const jwt = require('jsonwebtoken');
const config = require('../config');
const { UnauthorizedError } = require('../utils/errors');

/**
 * Verifies a bearer JWT (issued by services/auth.service.js on login) and attaches the
 * decoded payload as req.user. Routes that need an authenticated user use this; routes
 * that don't (webhooks — those are authenticated via GitHub's HMAC signature instead,
 * see integrations/github/webhook-verifier.js) never mount this.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or malformed Authorization header'));
  }

  const token = header.slice('Bearer '.length);

  try {
    req.user = jwt.verify(token, config.auth.jwtSecret);
    return next();
  } catch (err) {
    return next(new UnauthorizedError('Invalid or expired token'));
  }
}

module.exports = requireAuth;

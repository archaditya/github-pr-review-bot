const jwt = require('jsonwebtoken');
const config = require('../config');
const { UnauthorizedError } = require('../utils/errors');

/**
 * Verifies a session JWT and attaches the decoded payload as req.user. Accepts either:
 *  - `Authorization: Bearer <token>` (API/programmatic clients), or
 *  - the session cookie set by controllers/auth.controller.js on login (browser clients)
 *
 * Routes that don't need an authenticated user never mount this — webhooks are
 * authenticated via GitHub's HMAC signature instead (middlewares/verify-github-webhook).
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  let token;

  if (header?.startsWith('Bearer ')) {
    token = header.slice('Bearer '.length);
  } else if (req.cookies?.[config.auth.sessionCookieName]) {
    token = req.cookies[config.auth.sessionCookieName];
  }

  if (!token) {
    return next(new UnauthorizedError('Missing authentication token'));
  }

  try {
    req.user = jwt.verify(token, config.auth.jwtSecret);
    return next();
  } catch (err) {
    return next(new UnauthorizedError('Invalid or expired token'));
  }
}

module.exports = requireAuth;

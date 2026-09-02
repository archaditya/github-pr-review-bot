const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../models');
const apiKeyService = require('../services/api-key.service');
const { UnauthorizedError } = require('../utils/errors');

/**
 * Verifies authentication via:
 * 1. Authorization: Bearer <token>
 * 2. Session cookie (archadi_session)
 * 3. X-App-Key header (Allows seamless access across office/remote devices without re-authenticating GitHub)
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const appKey = req.headers['x-app-key'];
  let token;

  if (header?.startsWith('Bearer ')) {
    token = header.slice('Bearer '.length);
  } else if (req.cookies?.[config.auth.sessionCookieName]) {
    token = req.cookies[config.auth.sessionCookieName];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, config.auth.jwtSecret);
      req.user = {
        ...decoded,
        id: decoded.id || decoded.sub,
        sub: decoded.sub || decoded.id,
      };
      return next();
    } catch {
      // Fall through to try appKey if token expired or invalid
    }
  }

  if (appKey) {
    try {
      const apiKey = await apiKeyService.validateKey(appKey);
      if (apiKey) {
        let user = null;
        if (apiKey.createdByUserId) {
          user = await db.User.findByPk(apiKey.createdByUserId);
        }
        if (!user) {
          // Default to the first registered user (admin/owner)
          user = await db.User.findOne({ order: [['createdAt', 'ASC']] });
        }

        if (user) {
          req.user = {
            id: user.id,
            sub: user.id,
            isApiKey: true,
            apiKeyId: apiKey.id,
          };
          return next();
        }
      }
    } catch (err) {
      return next(new UnauthorizedError('Invalid App Key'));
    }
  }

  return next(new UnauthorizedError('Missing or invalid authentication token'));
}

module.exports = requireAuth;

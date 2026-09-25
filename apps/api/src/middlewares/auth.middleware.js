const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../models');
const apiKeyService = require('../services/api-key.service');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

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
      const user = await db.User.findByPk(decoded.sub || decoded.id, {
        attributes: ['id', 'role', 'status', 'features'],
      });

      if (!user) {
        return next(new UnauthorizedError('User no longer exists'));
      }

      if (user.status === 'suspended') {
        return next(new ForbiddenError('Your account is suspended. Please contact the administrator.'));
      }

      req.user = {
        ...decoded,
        id: user.id,
        sub: user.id,
        role: user.role,
        status: user.status,
        features: user.features || {},
      };
      return next();
    } catch (err) {
      if (err instanceof ForbiddenError) return next(err);
      // Fall through to try appKey if token expired or invalid
    }
  }

  if (appKey) {
    try {
      const apiKey = await apiKeyService.validateKey(appKey);
      if (apiKey) {
        let user = null;
        if (apiKey.createdByUserId) {
          user = await db.User.findByPk(apiKey.createdByUserId, {
            attributes: ['id', 'role', 'status', 'features'],
          });
        }
        if (!user) {
          // Default to the first registered user (admin/owner)
          user = await db.User.findOne({
            order: [['createdAt', 'ASC']],
            attributes: ['id', 'role', 'status', 'features'],
          });
        }

        if (user) {
          if (user.status === 'suspended') {
            return next(new ForbiddenError('Your account is suspended. Please contact the administrator.'));
          }

          req.user = {
            id: user.id,
            sub: user.id,
            role: user.role,
            status: user.status,
            features: user.features || {},
            isApiKey: true,
            apiKeyId: apiKey.id,
          };
          return next();
        }
      }
    } catch (err) {
      if (err instanceof ForbiddenError) return next(err);
      return next(new UnauthorizedError('Invalid App Key'));
    }
  }

  return next(new UnauthorizedError('Missing or invalid authentication token'));
}

/**
 * Middleware requiring admin role.
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return next(new ForbiddenError('Admin access required'));
  }
  return next();
}

/**
 * Middleware requiring specific entitlement flag.
 * @param {string} featureKey - e.g. 'can_social_studio', 'can_review_prs', 'can_repo_chat'
 */
function requireEntitlement(featureKey) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }
    // Admins bypass feature entitlement restrictions
    if (req.user.role === 'admin') {
      return next();
    }
    const features = req.user.features || {};
    if (!features[featureKey]) {
      return next(new ForbiddenError(`Your account is not entitled to use feature: ${featureKey}`));
    }
    return next();
  };
}

module.exports = requireAuth;
module.exports.requireAuth = requireAuth;
module.exports.requireAdmin = requireAdmin;
module.exports.requireEntitlement = requireEntitlement;


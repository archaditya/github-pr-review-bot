const jwt = require('jsonwebtoken');
const config = require('../config');
const apiKeyService = require('../services/api-key.service');
const logger = require('../utils/logger');

/**
 * Access Control Middleware:
 * Allows request if:
 * 1. Path is public/exempt (/health, /webhooks, /auth, /api/auth, /api/inngest)
 * 2. OR User has a valid logged-in session cookie (JWT)
 * 3. OR Client provides a valid X-App-Key header
 */
const EXEMPT_PREFIXES = [
  '/health',
  '/api/health',
  '/webhooks',
  '/api/webhooks',
  '/auth',
  '/api/auth',
  '/api/inngest',
];

function isExempt(path) {
  return EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix));
}

async function appKeyMiddleware(req, res, next) {
  // 1. Skip validation for exempt paths (OAuth login, webhooks, health checks)
  if (isExempt(req.path)) {
    return next();
  }

  // 2. Check if user is authenticated via session cookie (Dashboard browser session)
  const sessionToken = req.cookies?.[config.auth.sessionCookieName];
  if (sessionToken) {
    try {
      req.user = jwt.verify(sessionToken, config.auth.jwtSecret);
      return next();
    } catch {
      // Invalid/expired session cookie — fallback to check X-App-Key
    }
  }

  // 3. Check for X-App-Key header (Programmatic API access & browser app key)
  const appKey = req.headers['x-app-key'];
  if (appKey) {
    try {
      const validKey = await apiKeyService.validateKey(appKey);
      if (validKey) {
        req.appKey = validKey;
        return next();
      }
      return res.status(403).json({
        error: {
          code: 'INVALID_APP_KEY',
          message: 'Invalid or revoked app key',
        },
      });
    } catch (err) {
      logger.error({ err }, 'app key validation error');
      return res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to validate app key',
        },
      });
    }
  }

  // Neither valid session cookie nor App Key provided
  return res.status(401).json({
    error: {
      code: 'UNAUTHORIZED',
      message: 'Authentication required. Please log in or provide X-App-Key header.',
    },
  });
}

module.exports = appKeyMiddleware;

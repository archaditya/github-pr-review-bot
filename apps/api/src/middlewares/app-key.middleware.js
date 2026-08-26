const apiKeyService = require('../services/api-key.service');
const logger = require('../utils/logger');

/**
 * App Key middleware — validates X-App-Key header on every request.
 * Exempt paths: /health, /webhooks (GitHub needs to reach these without a key).
 *
 * This is a personal application guard — only users with a valid app key
 * can access the API. Keys are managed via the dashboard settings page.
 */
const EXEMPT_PATHS = ['/health', '/webhooks', '/api/inngest'];

function isExempt(path) {
  return EXEMPT_PATHS.some((exempt) => path.startsWith(exempt));
}

async function appKeyMiddleware(req, res, next) {
  // Skip validation for exempt paths
  if (isExempt(req.path)) {
    return next();
  }

  const appKey = req.headers['x-app-key'];
  if (!appKey) {
    return res.status(401).json({
      error: {
        code: 'MISSING_APP_KEY',
        message: 'X-App-Key header is required',
      },
    });
  }

  try {
    const validKey = await apiKeyService.validateKey(appKey);
    if (!validKey) {
      return res.status(403).json({
        error: {
          code: 'INVALID_APP_KEY',
          message: 'Invalid or revoked app key',
        },
      });
    }

    // Attach key info to request for downstream use
    req.appKey = validKey;
    return next();
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

module.exports = appKeyMiddleware;

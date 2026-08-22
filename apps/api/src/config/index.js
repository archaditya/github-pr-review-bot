const { parseEnv } = require('./env.schema');

const env = parseEnv();

/**
 * Typed, validated config. Import this instead of touching process.env anywhere else
 * in the codebase (src/config/README.md).
 */
const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isDevelopment: env.NODE_ENV === 'development',
  isTest: env.NODE_ENV === 'test',

  port: env.PORT,
  logLevel: env.LOG_LEVEL,
  corsOrigin: env.CORS_ORIGIN,
  webAppUrl: env.WEB_APP_URL,

  database: {
    url: env.DATABASE_URL,
  },

  auth: {
    jwtSecret: env.JWT_SECRET,
    sessionCookieName: env.SESSION_COOKIE_NAME,
  },

  github: {
    appId: env.GITHUB_APP_ID,
    privateKey: env.GITHUB_APP_PRIVATE_KEY,
    webhookSecret: env.GITHUB_WEBHOOK_SECRET,
    oauthClientId: env.GITHUB_OAUTH_CLIENT_ID,
    oauthClientSecret: env.GITHUB_OAUTH_CLIENT_SECRET,
    oauthRedirectUri: env.GITHUB_OAUTH_REDIRECT_URI,
    botHandle: env.GITHUB_BOT_HANDLE,
  },

  aiService: {
    baseUrl: env.AI_SERVICE_BASE_URL,
    timeoutMs: env.AI_SERVICE_TIMEOUT_MS,
    circuitBreaker: {
      failureThreshold: env.AI_SERVICE_CB_FAILURE_THRESHOLD,
      resetTimeoutMs: env.AI_SERVICE_CB_RESET_TIMEOUT_MS,
    },
  },

  inngest: {
    eventKey: env.INNGEST_EVENT_KEY,
    signingKey: env.INNGEST_SIGNING_KEY,
  },
};

module.exports = config;

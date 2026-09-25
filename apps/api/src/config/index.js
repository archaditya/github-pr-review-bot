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

  indexerServiceUrl: process.env.INDEXER_SERVICE_URL || 'http://indexer-service:8001',

  social: {
    x: {
      apiKey: env.X_API_KEY,
      apiSecret: env.X_API_SECRET,
      accessToken: env.X_ACCESS_TOKEN,
      accessSecret: env.X_ACCESS_SECRET,
    },
    linkedin: {
      accessToken: env.LINKEDIN_ACCESS_TOKEN,
      personUrn: env.LINKEDIN_PERSON_URN,
    },
    meta: {
      pageAccessToken: env.META_PAGE_ACCESS_TOKEN,
      pageId: env.META_PAGE_ID,
      instagramAccountId: env.META_INSTAGRAM_ACCOUNT_ID,
    },
    openaiApiKey: env.OPENAI_API_KEY,
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://redis:6379',
  },
};

module.exports = config;

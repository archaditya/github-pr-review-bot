const { z } = require('zod');

/**
 * Every env var the app needs, validated once at startup.
 * Nothing outside src/config/ should read process.env directly (see src/config/README.md).
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().url(),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  SESSION_COOKIE_NAME: z.string().default('archadi_session'),

  GITHUB_APP_ID: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  GITHUB_OAUTH_CLIENT_ID: z.string().optional(),
  GITHUB_OAUTH_CLIENT_SECRET: z.string().optional(),
  GITHUB_OAUTH_REDIRECT_URI: z.string().url().default('http://localhost:4000/auth/github/callback'),
  GITHUB_BOT_HANDLE: z.string().default('archadi-bot'),

  WEB_APP_URL: z.string().url().default('http://localhost:3000'),

  AI_SERVICE_BASE_URL: z.string().url().default('http://ai-service:8000'),
  AI_SERVICE_TIMEOUT_MS: z.coerce.number().int().positive().default(90000),
  AI_SERVICE_CB_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(5),
  AI_SERVICE_CB_RESET_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),

  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Social media integrations (optional — features degrade gracefully if absent)
  X_API_KEY: z.string().optional(),
  X_API_SECRET: z.string().optional(),
  X_ACCESS_TOKEN: z.string().optional(),
  X_ACCESS_SECRET: z.string().optional(),
  LINKEDIN_ACCESS_TOKEN: z.string().optional(),
  LINKEDIN_PERSON_URN: z.string().optional(),
  META_PAGE_ACCESS_TOKEN: z.string().optional(),
  META_PAGE_ID: z.string().optional(),
  META_INSTAGRAM_ACCOUNT_ID: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(), // used by ai-service for DALL·E image generation

  CORS_ORIGIN: z.string().default('http://localhost:3000'),
});

function parseEnv(source = process.env) {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    // eslint-disable-next-line no-console
    console.error(`Invalid environment configuration:\n${formatted}`);
    process.exit(1);
  }

  return result.data;
}

module.exports = { envSchema, parseEnv };

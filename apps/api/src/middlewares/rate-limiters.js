const rateLimit = require('express-rate-limit');

/**
 * Helper to build custom rate limiters with uniform error format
 */
function createLimiter({ windowMs, limit, message, keyGenerator }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyGenerator || ((req) => req.user?.id || req.ip),
    handler: (req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: message || 'Too many requests. Please slow down and try again later.',
        },
      });
    },
  });
}

// 1. Auth limiter: protects login & OAuth callback endpoints from credential stuffing & flood
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: 'Too many authentication attempts. Please try again after 15 minutes.',
  keyGenerator: (req) => req.ip,
});

// 2. AI Key Test limiter: prevents using the backend as an OpenAI key oracle/scanner
const aiKeyTestLimiter = createLimiter({
  windowMs: 5 * 60 * 1000,
  limit: 5,
  message: 'Too many API key validation attempts. Please wait 5 minutes before trying again.',
});

// 3. AI Generation limiter: rate limits expensive LLM and DALL-E image generations
const aiGenerationLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  message: 'AI generation rate limit exceeded. Please wait a few minutes before generating more content.',
});

// 4. Social Publishing limiter: protects external APIs (X, LinkedIn, Meta) from bans due to burst calls
const socialPublishLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  message: 'Publishing rate limit reached. Please wait before publishing more posts.',
});

// 5. Chat Stream limiter: prevents streaming connection exhaustion
const chatStreamLimiter = createLimiter({
  windowMs: 5 * 60 * 1000,
  limit: 30,
  message: 'Chat message rate limit reached. Please wait a moment before sending another message.',
});

// 6. Admin limiter: protects administrative state changes
const adminLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  message: 'Admin action rate limit reached.',
});

module.exports = {
  authLimiter,
  aiKeyTestLimiter,
  aiGenerationLimiter,
  socialPublishLimiter,
  chatStreamLimiter,
  adminLimiter,
};

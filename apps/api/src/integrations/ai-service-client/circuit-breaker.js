const CircuitBreaker = require('opossum');
const config = require('../../config');
const logger = require('../../utils/logger');
const { callAiService } = require('./client');
const { AiServiceUnavailableError } = require('../../utils/errors');

// One breaker per capability/endpoint, so a failing conversation-reply flow doesn't trip
// the breaker for the (unrelated) review-generation flow — ADR-006.
const breakers = new Map();

function getBreaker(endpointName, path) {
  if (breakers.has(endpointName)) return breakers.get(endpointName);

  const breaker = new CircuitBreaker((payload) => callAiService(path, payload), {
    name: endpointName,
    timeout: config.aiService.timeoutMs,
    errorThresholdPercentage: 50,
    volumeThreshold: config.aiService.circuitBreaker.failureThreshold,
    resetTimeout: config.aiService.circuitBreaker.resetTimeoutMs,
    errorFilter: (err) => {
      // 4xx errors (client errors: 400, 422, etc.) are request issues, NOT service outages.
      // They must NOT count towards tripping the circuit breaker!
      return err.statusCode >= 400 && err.statusCode < 500;
    },
  });

  // When the circuit is open (or the call times out), fail fast with a typed error the
  // calling service maps to ReviewJob.status = RETRYING/FAILED — never a raw 500.
  // Never mask 4xx client errors behind a generic 503 AiServiceUnavailableError.
  breaker.fallback((payload, err) => {
    if (err && err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      throw err;
    }
    if (breaker.opened) {
      throw new AiServiceUnavailableError(`ai-service (${endpointName}) circuit breaker is OPEN`);
    }
    throw new AiServiceUnavailableError(
      `ai-service (${endpointName}) is unavailable: ${err?.message || 'unknown error'}`
    );
  });

  breaker.on('open', () => logger.warn({ endpoint: endpointName }, 'ai-service circuit opened'));
  breaker.on('halfOpen', () =>
    logger.info({ endpoint: endpointName }, 'ai-service circuit half-open'));
  breaker.on('close', () =>
    logger.info({ endpoint: endpointName }, 'ai-service circuit closed'));
  breaker.on('reject', () =>
    logger.warn({ endpoint: endpointName }, 'ai-service call rejected — circuit open'));

  breakers.set(endpointName, breaker);
  return breaker;
}

/**
 * ReviewContext -> structured findings. See docs/architecture/data-model.md § Review Context.
 */
async function generateReview(reviewContext) {
  return getBreaker('review.generate', '/review/generate').fire(reviewContext);
}

/**
 * ConversationContext -> a reply. See ADR-009.
 */
async function generateConversationReply(conversationContext) {
  return getBreaker('conversation.reply', '/conversation/reply').fire(conversationContext);
}

module.exports = { generateReview, generateConversationReply };

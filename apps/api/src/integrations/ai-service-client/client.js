const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * Raw HTTP call to ai-service. No retry/breaker logic here — see circuit-breaker.js,
 * which is the only caller of this module (ADR-006).
 */
async function callAiService(path, payload, { timeoutMs } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs || config.aiService.timeoutMs,
  );

  try {
    const res = await fetch(`${config.aiService.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.error({ status: res.status, path, responseBody: text }, 'ai-service call failed');
      const err = new Error(`ai-service responded ${res.status} for ${path}: ${text}`);
      err.statusCode = res.status;
      err.responseBody = text;
      throw err;
    }

    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { callAiService };

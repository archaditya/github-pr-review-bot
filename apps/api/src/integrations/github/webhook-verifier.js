const crypto = require('crypto');

/**
 * Verifies a GitHub webhook payload against its X-Hub-Signature-256 header (ADR-007).
 * Must be checked against the exact raw request bytes — app.js captures req.rawBody
 * specifically for this (a re-serialized JSON object won't produce the same HMAC).
 */
function verifySignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !rawBody || !secret) return false;

  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signatureHeader);

  if (expectedBuffer.length !== actualBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

module.exports = { verifySignature };

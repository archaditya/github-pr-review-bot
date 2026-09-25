const crypto = require('crypto');
const config = require('../config');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getEncryptionKey() {
  const secret = process.env.ENCRYPTION_MASTER_KEY || config.auth?.jwtSecret || 'archadi-fallback-secret-key-32b!';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * @param {string} text - Plaintext to encrypt
 * @returns {string|null} - Formatted as `${ivHex}:${authTagHex}:${encryptedHex}`
 */
function encrypt(text) {
  if (!text) return null;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 * @param {string} cipherPayload - Formatted as `${ivHex}:${authTagHex}:${encryptedHex}`
 * @returns {string|null} - Decrypted plaintext string
 */
function decrypt(cipherPayload) {
  if (!cipherPayload) return null;

  try {
    const parts = cipherPayload.split(':');
    if (parts.length !== 3) return null;

    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch {
    return null;
  }
}

/**
 * Masks an API key for safe display in UI/API responses.
 * Example: `sk-proj-uMUnHm...51AA`
 * @param {string} key
 * @returns {string}
 */
function maskApiKey(key) {
  if (!key || typeof key !== 'string') return '';
  if (key.length <= 10) return '••••••••';
  const prefix = key.slice(0, 10);
  const suffix = key.slice(-4);
  return `${prefix}...${suffix}`;
}

module.exports = {
  encrypt,
  decrypt,
  maskApiKey,
};

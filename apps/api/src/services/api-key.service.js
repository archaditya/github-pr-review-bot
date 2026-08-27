const crypto = require('crypto');
const db = require('../models');
const logger = require('../utils/logger');

/**
 * Generate a cryptographically random API key.
 * Returns { rawKey, keyHash, keyPrefix } — rawKey is shown once to the user,
 * keyHash is stored in DB, keyPrefix is for identification.
 */
function generateKeyPair() {
  const rawKey = `prbot_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.substring(0, 8);
  return { rawKey, keyHash, keyPrefix };
}

function hashKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

async function createApiKey(name, userId = null) {
  const { rawKey, keyHash, keyPrefix } = generateKeyPair();

  const apiKey = await db.ApiKey.create({
    name,
    keyHash,
    keyPrefix,
    isActive: true,
    createdByUserId: userId,
  });

  // rawKey is returned ONLY at creation time — never stored or retrievable again
  return { id: apiKey.id, name, rawKey, keyPrefix, createdAt: apiKey.createdAt };
}

async function validateKey(rawKey) {
  if (!rawKey) return null;

  const keyHash = hashKey(rawKey);
  const apiKey = await db.ApiKey.findOne({
    where: { keyHash, isActive: true },
  });

  if (apiKey) {
    // Update last_used_at without blocking the request
    apiKey.update({ lastUsedAt: new Date() }).catch((err) => {
      logger.warn({ err }, 'failed to update api key last_used_at');
    });
  }

  return apiKey;
}

async function listApiKeys() {
  return db.ApiKey.findAll({
    attributes: ['id', 'name', 'keyPrefix', 'isActive', 'lastUsedAt', 'createdAt'],
    order: [['createdAt', 'DESC']],
  });
}

async function revokeApiKey(keyId) {
  const apiKey = await db.ApiKey.findByPk(keyId);
  if (!apiKey) return null;
  await apiKey.update({ isActive: false });
  return apiKey;
}

async function deleteApiKey(keyId) {
  const apiKey = await db.ApiKey.findByPk(keyId);
  if (!apiKey) return null;
  await apiKey.destroy();
  return true;
}

module.exports = { createApiKey, validateKey, listApiKeys, revokeApiKey, deleteApiKey };

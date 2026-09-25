const db = require('../models');
const { encrypt, decrypt, maskApiKey } = require('../utils/crypto');
const { ValidationError, NotFoundError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Validates an OpenAI API key against the OpenAI REST API.
 * @param {string} apiKey - OpenAI API key (sk-...)
 * @returns {Promise<{ valid: boolean, error?: string, modelCount?: number }>}
 */
async function testOpenAiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim().startsWith('sk-')) {
    return { valid: false, error: 'Key must start with sk-' };
  }

  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      return { valid: true, modelCount: data.data?.length || 0 };
    }

    const errData = await res.json().catch(() => ({}));
    const message = errData?.error?.message || `OpenAI returned status ${res.status}`;
    return { valid: false, error: message };
  } catch (err) {
    logger.error({ err }, 'Error testing OpenAI key');
    return { valid: false, error: 'Could not connect to OpenAI API' };
  }
}

/**
 * Saves an encrypted OpenAI API key for a user.
 */
async function saveOpenAiKey(userId, apiKey) {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
    throw new ValidationError('A valid OpenAI API key is required');
  }

  const cleanKey = apiKey.trim();
  const testResult = await testOpenAiKey(cleanKey);
  if (!testResult.valid) {
    throw new ValidationError(`OpenAI API key validation failed: ${testResult.error}`);
  }

  const encrypted = encrypt(cleanKey);
  const user = await db.User.findByPk(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  await user.update({ openaiApiKeyEncrypted: encrypted });

  return {
    success: true,
    maskedKey: maskApiKey(cleanKey),
  };
}

/**
 * Deletes user's BYOK OpenAI API key.
 */
async function removeOpenAiKey(userId) {
  const user = await db.User.findByPk(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  await user.update({ openaiApiKeyEncrypted: null });
  return { success: true };
}

/**
 * Updates user preferences and platform selections.
 */
async function updatePreferences(userId, { preferences, allowedSocialPlatforms }) {
  const user = await db.User.findByPk(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const updates = {};
  if (preferences && typeof preferences === 'object') {
    updates.preferences = { ...user.preferences, ...preferences };
  }

  if (Array.isArray(allowedSocialPlatforms)) {
    const validPlatforms = ['x', 'linkedin', 'instagram', 'facebook'];
    const filtered = allowedSocialPlatforms.filter((p) => validPlatforms.includes(p));
    // Non-admins cannot enable 'x' unless their features allow it
    if (user.role !== 'admin' && filtered.includes('x')) {
      const allowedByAdmin = user.features?.allowed_social_platforms || [];
      if (!allowedByAdmin.includes('x')) {
        throw new ValidationError('X (Twitter) posting is restricted for your account tier.');
      }
    }

    const currentFeatures = user.features || {};
    updates.features = {
      ...currentFeatures,
      allowed_social_platforms: filtered,
    };
  }

  await user.update(updates);
  return {
    preferences: user.preferences,
    features: user.features,
  };
}

/**
 * Retrieves the decrypted OpenAI key for internal processing.
 * Only called by server-side workers/dispatchers (never sent to client).
 */
async function getDecryptedOpenAiKey(userId) {
  const user = await db.User.findByPk(userId, {
    attributes: ['id', 'role', 'openaiApiKeyEncrypted', 'features'],
  });

  if (!user) return null;

  if (user.openaiApiKeyEncrypted) {
    return decrypt(user.openaiApiKeyEncrypted);
  }

  // Admin users can fall back to system key in 'managed' mode
  if (user.role === 'admin' || user.features?.ai_provider_mode === 'managed') {
    return process.env.OPENAI_API_KEY || null;
  }

  return null;
}

module.exports = {
  testOpenAiKey,
  saveOpenAiKey,
  removeOpenAiKey,
  updatePreferences,
  getDecryptedOpenAiKey,
};

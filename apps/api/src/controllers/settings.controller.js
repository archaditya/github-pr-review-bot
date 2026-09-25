const settingsService = require('../services/settings.service');
const { ValidationError } = require('../utils/errors');
const db = require('../models');
const { decrypt, maskApiKey } = require('../utils/crypto');

async function getSettings(req, res, next) {
  try {
    const user = await db.User.findByPk(req.user.id, {
      attributes: ['id', 'role', 'status', 'features', 'preferences', 'usage', 'openaiApiKeyEncrypted'],
    });

    if (!user) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    }

    const hasOpenaiKey = Boolean(user.openaiApiKeyEncrypted);
    let maskedOpenaiKey = null;
    if (hasOpenaiKey) {
      const decrypted = decrypt(user.openaiApiKeyEncrypted);
      maskedOpenaiKey = maskApiKey(decrypted);
    }

    return res.json({
      data: {
        role: user.role,
        status: user.status,
        features: user.features,
        preferences: user.preferences,
        usage: user.usage,
        hasOpenaiKey,
        maskedOpenaiKey,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function saveAiKey(req, res, next) {
  try {
    const { apiKey } = req.body;
    if (!apiKey) {
      throw new ValidationError('OpenAI API key is required');
    }
    const result = await settingsService.saveOpenAiKey(req.user.id, apiKey);
    return res.json({ data: result });
  } catch (err) {
    return next(err);
  }
}

async function removeAiKey(req, res, next) {
  try {
    const result = await settingsService.removeOpenAiKey(req.user.id);
    return res.json({ data: result });
  } catch (err) {
    return next(err);
  }
}

async function testAiKey(req, res, next) {
  try {
    let keyToTest = req.body?.apiKey;
    if (!keyToTest) {
      keyToTest = await settingsService.getDecryptedOpenAiKey(req.user.id);
    }
    if (!keyToTest) {
      throw new ValidationError('No API key provided or configured to test');
    }
    const result = await settingsService.testOpenAiKey(keyToTest);
    return res.json({ data: result });
  } catch (err) {
    return next(err);
  }
}

async function updatePreferences(req, res, next) {
  try {
    const { preferences, allowedSocialPlatforms } = req.body;
    const result = await settingsService.updatePreferences(req.user.id, {
      preferences,
      allowedSocialPlatforms,
    });
    return res.json({ data: result });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getSettings,
  saveAiKey,
  removeAiKey,
  testAiKey,
  updatePreferences,
};

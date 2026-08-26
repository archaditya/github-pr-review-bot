const apiKeyService = require('../services/api-key.service');

async function listKeys(req, res, next) {
  try {
    const keys = await apiKeyService.listApiKeys();
    return res.json({ data: keys });
  } catch (err) {
    next(err);
  }
}

async function createKey(req, res, next) {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'name is required' },
      });
    }

    const userId = req.user?.id || null;
    const result = await apiKeyService.createApiKey(name.trim(), userId);

    // rawKey is returned ONLY here — client must save it
    return res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function revokeKey(req, res, next) {
  try {
    const { id } = req.params;
    const key = await apiKeyService.revokeApiKey(id);
    if (!key) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'API key not found' },
      });
    }
    return res.json({ data: { id: key.id, isActive: false } });
  } catch (err) {
    next(err);
  }
}

async function deleteKey(req, res, next) {
  try {
    const { id } = req.params;
    const result = await apiKeyService.deleteApiKey(id);
    if (!result) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'API key not found' },
      });
    }
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { listKeys, createKey, revokeKey, deleteKey };

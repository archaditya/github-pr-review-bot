const healthService = require('../services/health.service');

async function liveness(req, res) {
  const result = await healthService.checkLiveness();
  res.status(200).json(result);
}

async function readiness(req, res) {
  try {
    const result = await healthService.checkReadiness();
    res.status(200).json(result);
  } catch (err) {
    res.status(503).json({ status: 'unavailable', ...(err.details || {}) });
  }
}

module.exports = { liveness, readiness };

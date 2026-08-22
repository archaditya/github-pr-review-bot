const db = require('../models');

async function checkLiveness() {
  return { status: 'ok' };
}

async function checkReadiness() {
  try {
    await db.sequelize.authenticate();
    return { status: 'ok', database: 'connected' };
  } catch (err) {
    const error = new Error('Database connection check failed');
    error.cause = err;
    error.details = { database: 'disconnected' };
    throw error;
  }
}

module.exports = { checkLiveness, checkReadiness };

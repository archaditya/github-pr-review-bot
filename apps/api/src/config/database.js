const { Sequelize } = require('sequelize');
const config = require('./index');
const logger = require('../utils/logger');

const sequelize = new Sequelize(config.database.url, {
  dialect: 'postgres',
  logging: config.isDevelopment
    ? (sql) => logger.debug({ sql }, 'sequelize query')
    : false,
  define: {
    underscored: true, // JS camelCase <-> DB snake_case columns
    timestamps: true,
  },
  pool: {
    max: config.isProduction ? 20 : 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

module.exports = sequelize;

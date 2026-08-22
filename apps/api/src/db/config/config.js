require('dotenv').config();

/**
 * Config consumed only by sequelize-cli (migrations/seeders), not by the running app
 * (the app uses src/config/database.js, built from the validated config object).
 * Kept deliberately simple/standalone since the CLI runs outside the app's bootstrap.
 */
const base = {
  use_env_variable: 'DATABASE_URL',
  dialect: 'postgres',
  define: {
    underscored: true,
    timestamps: true,
  },
};

module.exports = {
  development: { ...base },
  test: { ...base },
  production: {
    ...base,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  },
};

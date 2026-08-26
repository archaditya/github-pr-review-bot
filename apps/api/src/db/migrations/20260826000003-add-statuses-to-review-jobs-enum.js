'use strict';

module.exports = {
  up: async (queryInterface) => {
    // PostgreSQL ENUM types require explicit ALTER TYPE to add new values
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_review_jobs_status" ADD VALUE IF NOT EXISTS 'ANALYZING_IMPACT';
    `);
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_review_jobs_status" ADD VALUE IF NOT EXISTS 'BUILDING_CONTEXT';
    `);
  },

  down: async () => {
    // PostgreSQL does not natively support removing enum values
  },
};

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('review_jobs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      pull_request_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'pull_requests', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      status: {
        type: Sequelize.ENUM(
          'PENDING',
          'FETCHING_DIFF',
          'RESOLVING_USAGES',
          'GENERATING_REVIEW',
          'POSTING_COMMENTS',
          'COMPLETED',
          'FAILED',
          'RETRYING',
        ),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      attempt_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      error: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('review_jobs', ['pull_request_id']);
    await queryInterface.addIndex('review_jobs', ['status']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('review_jobs');
    // ENUM types persist after dropTable on Postgres — drop explicitly to keep `down` clean
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_review_jobs_status";');
  },
};

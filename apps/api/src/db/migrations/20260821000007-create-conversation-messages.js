'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('conversation_messages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      review_job_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'review_jobs', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      github_comment_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        unique: true,
      },
      author_type: {
        type: Sequelize.ENUM('bot', 'user'),
        allowNull: false,
      },
      author_login: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      body: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('conversation_messages', ['review_job_id', 'created_at']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('conversation_messages');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_conversation_messages_author_type";',
    );
  },
};

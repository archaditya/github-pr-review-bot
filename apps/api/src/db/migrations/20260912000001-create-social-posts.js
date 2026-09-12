'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('social_posts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      pull_request_id: {
        type: Sequelize.UUID,
        allowNull: true, // nullable for standalone posts (not PR-triggered)
        references: { model: 'pull_requests', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      platform: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      draft_text: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      edited_text: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      image_url: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'draft',
      },
      published_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      external_post_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      error: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      // Standalone post fields — used when post is not PR-triggered
      standalone_input: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      repo_context: {
        type: Sequelize.STRING,
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

    // One post per platform per PR (only when PR-linked)
    await queryInterface.addIndex('social_posts', ['pull_request_id', 'platform'], {
      unique: true,
      where: { pull_request_id: { [Sequelize.Op.ne]: null } },
      name: 'social_posts_pr_platform_unique',
    });

    await queryInterface.addIndex('social_posts', ['status']);
    await queryInterface.addIndex('social_posts', ['created_at']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('social_posts');
  },
};

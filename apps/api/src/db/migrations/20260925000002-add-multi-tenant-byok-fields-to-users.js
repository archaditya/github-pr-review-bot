'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'role', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'user',
    });

    await queryInterface.addColumn('users', 'status', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'active',
    });

    await queryInterface.addColumn('users', 'openai_api_key_encrypted', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn('users', 'features', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {
        can_review_prs: true,
        can_repo_chat: true,
        can_social_studio: true,
        allowed_social_platforms: ['linkedin', 'instagram', 'facebook'],
        social_monthly_quota: 20,
        ai_provider_mode: 'byok_only',
        max_indexed_repos: 5,
      },
    });

    await queryInterface.addColumn('users', 'preferences', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {},
    });

    await queryInterface.addColumn('users', 'social_credentials_encrypted', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {},
    });

    await queryInterface.addColumn('users', 'usage', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {
        review_count: 0,
        post_count: 0,
        chat_count: 0,
        reset_at: null,
      },
    });

    await queryInterface.addColumn('users', 'last_active_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Make existing users (and specifically archaditya) admin
    await queryInterface.sequelize.query(
      `UPDATE users SET role = 'admin' WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)`
    );
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('users', 'last_active_at');
    await queryInterface.removeColumn('users', 'usage');
    await queryInterface.removeColumn('users', 'social_credentials_encrypted');
    await queryInterface.removeColumn('users', 'preferences');
    await queryInterface.removeColumn('users', 'features');
    await queryInterface.removeColumn('users', 'openai_api_key_encrypted');
    await queryInterface.removeColumn('users', 'status');
    await queryInterface.removeColumn('users', 'role');
  },
};

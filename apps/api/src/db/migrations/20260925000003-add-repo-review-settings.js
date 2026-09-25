'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('repositories', 'ai_review_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });

    await queryInterface.addColumn('repositories', 'review_level', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'balanced',
    });

    await queryInterface.addColumn('repositories', 'custom_voice', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('repositories', 'custom_voice');
    await queryInterface.removeColumn('repositories', 'review_level');
    await queryInterface.removeColumn('repositories', 'ai_review_enabled');
  },
};

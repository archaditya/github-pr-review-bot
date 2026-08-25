'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('installations', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      github_installation_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        unique: true,
      },
      account_login: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      installed_by_user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
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

    await queryInterface.addIndex('installations', ['installed_by_user_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('installations');
  },
};

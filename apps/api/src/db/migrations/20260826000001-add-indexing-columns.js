'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('repositories', 'index_status', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'NOT_INDEXED',
    });

    await queryInterface.addColumn('repositories', 'indexed_commit_sha', {
      type: Sequelize.STRING(40),
      allowNull: true,
    });

    await queryInterface.addColumn('repositories', 'indexed_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('repositories', 'default_branch', {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: 'main',
    });

    await queryInterface.addColumn('repositories', 'index_error', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn('repositories', 'file_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addColumn('repositories', 'symbol_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('repositories', 'index_status');
    await queryInterface.removeColumn('repositories', 'indexed_commit_sha');
    await queryInterface.removeColumn('repositories', 'indexed_at');
    await queryInterface.removeColumn('repositories', 'default_branch');
    await queryInterface.removeColumn('repositories', 'index_error');
    await queryInterface.removeColumn('repositories', 'file_count');
    await queryInterface.removeColumn('repositories', 'symbol_count');
  },
};

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('pull_requests', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      repository_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'repositories', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      github_pr_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      head_sha: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      base_sha: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      author_login: {
        type: Sequelize.STRING,
        allowNull: false,
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

    await queryInterface.addIndex('pull_requests', ['repository_id', 'github_pr_number'], {
      unique: true,
      name: 'pull_requests_repository_id_github_pr_number_unique',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('pull_requests');
  },
};

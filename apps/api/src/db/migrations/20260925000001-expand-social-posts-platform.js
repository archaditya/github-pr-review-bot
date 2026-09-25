'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('social_posts', 'platform', {
      type: Sequelize.STRING(20),
      allowNull: false,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('social_posts', 'platform', {
      type: Sequelize.STRING(10),
      allowNull: false,
    });
  },
};

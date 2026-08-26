'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('api_keys', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Human-readable label for this key (e.g. "VPS Production", "Local Dev")',
      },
      key_hash: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
        comment: 'SHA256 hash of the raw API key — raw key is never stored',
      },
      key_prefix: {
        type: Sequelize.STRING(8),
        allowNull: false,
        comment: 'First 8 chars of the key for identification in UI',
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      last_used_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_by_user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('api_keys', ['key_hash'], {
      unique: true,
      name: 'api_keys_key_hash_unique',
    });

    await queryInterface.addIndex('api_keys', ['is_active'], {
      name: 'api_keys_is_active',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('api_keys');
  },
};

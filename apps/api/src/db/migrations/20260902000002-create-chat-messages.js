'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('chat_messages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      session_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'chat_sessions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      role: {
        type: Sequelize.ENUM('user', 'assistant'),
        allowNull: false,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      citations: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Array of {file_path, symbol_fqn, start_line, end_line, label}',
      },
      intent: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Classified intent from the query (structural, semantic, overview, greeting)',
      },
      model_used: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Which LLM model generated this response',
      },
      token_count: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Approximate token count for cost tracking',
      },
      latency_ms: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'End-to-end latency for this message generation',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('chat_messages', ['session_id', 'created_at'], {
      name: 'chat_messages_session_timeline',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('chat_messages');
  },
};

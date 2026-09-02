const { DataTypes, Model } = require('sequelize');

const ROLES = Object.freeze({ USER: 'user', ASSISTANT: 'assistant' });

module.exports = (sequelize) => {
  class ChatMessage extends Model {
    static associate(models) {
      ChatMessage.belongsTo(models.ChatSession, {
        foreignKey: 'sessionId',
        as: 'session',
      });
    }
  }

  ChatMessage.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      sessionId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'chat_sessions', key: 'id' },
      },
      role: {
        type: DataTypes.ENUM(...Object.values(ROLES)),
        allowNull: false,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      citations: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      intent: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      modelUsed: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      tokenCount: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      latencyMs: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'ChatMessage',
      tableName: 'chat_messages',
      updatedAt: false, // append-only — messages are never edited
    },
  );

  ChatMessage.ROLES = ROLES;

  return ChatMessage;
};

const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class ChatSession extends Model {
    static associate(models) {
      ChatSession.belongsTo(models.Repository, {
        foreignKey: 'repositoryId',
        as: 'repository',
      });
      ChatSession.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
      });
      ChatSession.hasMany(models.ChatMessage, {
        foreignKey: 'sessionId',
        as: 'messages',
      });
    }
  }

  ChatSession.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      repositoryId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'repositories', key: 'id' },
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'New Chat',
      },
    },
    {
      sequelize,
      modelName: 'ChatSession',
      tableName: 'chat_sessions',
    },
  );

  return ChatSession;
};

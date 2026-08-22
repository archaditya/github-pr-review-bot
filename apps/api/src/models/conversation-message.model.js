const { DataTypes, Model } = require('sequelize');

const AUTHOR_TYPES = Object.freeze({ BOT: 'bot', USER: 'user' });

module.exports = (sequelize) => {
  class ConversationMessage extends Model {
    static associate(models) {
      ConversationMessage.belongsTo(models.ReviewJob, {
        foreignKey: 'reviewJobId',
        as: 'reviewJob',
      });
    }
  }

  ConversationMessage.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      reviewJobId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'review_jobs', key: 'id' },
      },
      githubCommentId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        unique: true,
      },
      authorType: {
        type: DataTypes.ENUM(...Object.values(AUTHOR_TYPES)),
        allowNull: false,
      },
      authorLogin: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      body: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'ConversationMessage',
      tableName: 'conversation_messages',
      updatedAt: false, // append-only — messages are never edited once persisted
    },
  );

  ConversationMessage.AUTHOR_TYPES = AUTHOR_TYPES;

  return ConversationMessage;
};

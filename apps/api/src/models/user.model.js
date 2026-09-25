const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class User extends Model {
    static associate(models) {
      User.hasMany(models.Installation, {
        foreignKey: 'installedByUserId',
        as: 'installations',
      });
    }
  }

  User.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      githubUserId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        unique: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: { isEmail: true },
      },
      name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      role: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'user',
        validate: {
          isIn: [['admin', 'user']],
        },
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'active',
        validate: {
          isIn: [['active', 'pending', 'suspended']],
        },
      },
      openaiApiKeyEncrypted: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      features: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {
          can_review_prs: true,
          can_repo_chat: true,
          can_social_studio: true,
          allowed_social_platforms: ['linkedin', 'instagram', 'facebook'],
          social_monthly_quota: 20,
          ai_provider_mode: 'byok_only',
          max_indexed_repos: 5,
        },
      },
      preferences: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      socialCredentialsEncrypted: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      usage: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {
          review_count: 0,
          post_count: 0,
          chat_count: 0,
          reset_at: null,
        },
      },
      lastActiveAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'users',
      underscored: true,
    },
  );

  return User;
};

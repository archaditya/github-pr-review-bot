const { DataTypes, Model } = require('sequelize');

const SOCIAL_PLATFORMS = {
  X: 'x',
  LINKEDIN: 'linkedin',
  INSTAGRAM: 'instagram',
  FACEBOOK: 'facebook',
};
const SOCIAL_POST_STATUSES = { DRAFT: 'draft', APPROVED: 'approved', PUBLISHED: 'published', FAILED: 'failed' };

module.exports = (sequelize) => {
  class SocialPost extends Model {
    static associate(models) {
      SocialPost.belongsTo(models.PullRequest, {
        foreignKey: 'pullRequestId',
        as: 'pullRequest',
      });
    }
  }

  SocialPost.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      pullRequestId: {
        type: DataTypes.UUID,
        allowNull: true, // nullable for standalone posts
        references: { model: 'pull_requests', key: 'id' },
      },
      platform: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
          isIn: [Object.values(SOCIAL_PLATFORMS)],
        },
      },
      draftText: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      editedText: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      imageUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: SOCIAL_POST_STATUSES.DRAFT,
        validate: {
          isIn: [Object.values(SOCIAL_POST_STATUSES)],
        },
      },
      publishedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      externalPostId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      error: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      // Used for standalone (non-PR) posts — the user's raw input/idea
      standaloneInput: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      // Optional repo context hint for standalone posts (e.g. "bytevault", "verkin")
      repoContext: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'SocialPost',
      tableName: 'social_posts',
      indexes: [
        {
          unique: true,
          fields: ['pull_request_id', 'platform'],
          where: { pull_request_id: { [require('sequelize').Op.ne]: null } },
          name: 'social_posts_pr_platform_unique',
        },
      ],
    },
  );

  SocialPost.PLATFORMS = SOCIAL_PLATFORMS;
  SocialPost.STATUSES = SOCIAL_POST_STATUSES;

  return SocialPost;
};

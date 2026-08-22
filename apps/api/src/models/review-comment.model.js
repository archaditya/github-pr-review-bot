const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class ReviewComment extends Model {
    static associate(models) {
      ReviewComment.belongsTo(models.ReviewJob, {
        foreignKey: 'reviewJobId',
        as: 'reviewJob',
      });
    }
  }

  ReviewComment.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      reviewJobId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true, // one summary comment per ReviewJob (ADR-009)
        references: { model: 'review_jobs', key: 'id' },
      },
      body: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      githubCommentId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        unique: true,
      },
      // Structured per-finding data (file, line, severity, rationale) that was rendered
      // into `body` — kept alongside the rendered text so the conversation agent can
      // reference specific findings without re-parsing markdown (ADR-009).
      findings: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
    },
    {
      sequelize,
      modelName: 'ReviewComment',
      tableName: 'review_comments',
    },
  );

  return ReviewComment;
};

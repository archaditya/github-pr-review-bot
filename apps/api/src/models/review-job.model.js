const { DataTypes, Model } = require('sequelize');
const {
  REVIEW_JOB_STATUSES,
  isValidTransition,
} = require('../constants/review-job-status');
const { InvalidStateTransitionError } = require('../utils/errors');

module.exports = (sequelize) => {
  class ReviewJob extends Model {
    static associate(models) {
      ReviewJob.belongsTo(models.PullRequest, {
        foreignKey: 'pullRequestId',
        as: 'pullRequest',
      });
      ReviewJob.hasOne(models.ReviewComment, {
        foreignKey: 'reviewJobId',
        as: 'summaryComment',
      });
      ReviewJob.hasMany(models.ConversationMessage, {
        foreignKey: 'reviewJobId',
        as: 'conversationMessages',
      });
      ReviewJob.hasMany(models.JobEvent, {
        foreignKey: 'reviewJobId',
        as: 'events',
      });
    }
  }

  ReviewJob.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      pullRequestId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'pull_requests', key: 'id' },
      },
      status: {
        type: DataTypes.ENUM(...Object.values(REVIEW_JOB_STATUSES)),
        allowNull: false,
        defaultValue: REVIEW_JOB_STATUSES.PENDING,
      },
      attemptCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      error: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      startedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'ReviewJob',
      tableName: 'review_jobs',
      hooks: {
        // Guards every status write against the transition map in
        // src/constants/review-job-status.js — an out-of-order or skipped transition
        // raises instead of silently persisting (docs/architecture/data-model.md).
        beforeUpdate: (job) => {
          if (!job.changed('status')) return;

          const previous = job.previous('status');
          const next = job.get('status');

          if (!isValidTransition(previous, next)) {
            throw new InvalidStateTransitionError(
              `ReviewJob cannot transition from ${previous} to ${next}`,
            );
          }
        },
      },
    },
  );

  return ReviewJob;
};

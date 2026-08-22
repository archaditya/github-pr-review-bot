const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class JobEvent extends Model {
    static associate(models) {
      JobEvent.belongsTo(models.ReviewJob, {
        foreignKey: 'reviewJobId',
        as: 'reviewJob',
      });
    }
  }

  JobEvent.init(
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
      step: {
        type: DataTypes.STRING,
        allowNull: false, // e.g. "fetch_diff", "resolve_usages", "generate_review"
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false, // e.g. "started", "succeeded", "failed", "retried"
      },
      detail: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'JobEvent',
      tableName: 'job_events',
      updatedAt: false, // append-only audit log
    },
  );

  return JobEvent;
};

const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class PullRequest extends Model {
    static associate(models) {
      PullRequest.belongsTo(models.Repository, {
        foreignKey: 'repositoryId',
        as: 'repository',
      });
      PullRequest.hasMany(models.ReviewJob, {
        foreignKey: 'pullRequestId',
        as: 'reviewJobs',
      });
    }
  }

  PullRequest.init(
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
      githubPrNumber: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      headSha: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      baseSha: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      authorLogin: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'PullRequest',
      tableName: 'pull_requests',
      indexes: [
        {
          unique: true,
          fields: ['repository_id', 'github_pr_number'],
        },
      ],
    },
  );

  return PullRequest;
};

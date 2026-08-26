const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class Repository extends Model {
    static associate(models) {
      Repository.belongsTo(models.Installation, {
        foreignKey: 'installationId',
        as: 'installation',
      });
      Repository.hasMany(models.PullRequest, {
        foreignKey: 'repositoryId',
        as: 'pullRequests',
      });
    }
  }

  Repository.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      installationId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'installations', key: 'id' },
      },
      githubRepoId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        unique: true,
      },
      fullName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      indexStatus: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'NOT_INDEXED',
      },
      indexedCommitSha: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },
      indexedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      defaultBranch: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: 'main',
      },
      indexError: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      fileCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      symbolCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      sequelize,
      modelName: 'Repository',
      tableName: 'repositories',
    },
  );

  return Repository;
};

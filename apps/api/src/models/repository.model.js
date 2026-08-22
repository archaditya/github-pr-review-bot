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
    },
    {
      sequelize,
      modelName: 'Repository',
      tableName: 'repositories',
    },
  );

  return Repository;
};

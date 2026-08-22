const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class Installation extends Model {
    static associate(models) {
      Installation.belongsTo(models.User, {
        foreignKey: 'installedByUserId',
        as: 'installedBy',
      });
      Installation.hasMany(models.Repository, {
        foreignKey: 'installationId',
        as: 'repositories',
      });
    }
  }

  Installation.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      githubInstallationId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        unique: true,
      },
      accountLogin: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      installedByUserId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
      },
    },
    {
      sequelize,
      modelName: 'Installation',
      tableName: 'installations',
    },
  );

  return Installation;
};

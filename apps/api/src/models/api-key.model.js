const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class ApiKey extends Model {
    static associate(models) {
      ApiKey.belongsTo(models.User, {
        foreignKey: 'createdByUserId',
        as: 'createdBy',
      });
    }
  }

  ApiKey.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      keyHash: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
      },
      keyPrefix: {
        type: DataTypes.STRING(16),
        allowNull: false,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      lastUsedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      createdByUserId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      },
    },
    {
      sequelize,
      modelName: 'ApiKey',
      tableName: 'api_keys',
    },
  );

  return ApiKey;
};

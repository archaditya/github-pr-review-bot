const fs = require('fs');
const path = require('path');
const sequelize = require('../config/database');

const basename = path.basename(__filename);
const db = {};

fs.readdirSync(__dirname)
  .filter((file) => file !== basename && file.endsWith('.model.js'))
  .forEach((file) => {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const modelDef = require(path.join(__dirname, file));
    const model = modelDef(sequelize);
    db[model.name] = model;
  });

Object.values(db).forEach((model) => {
  if (typeof model.associate === 'function') {
    model.associate(db);
  }
});

db.sequelize = sequelize;

module.exports = db;

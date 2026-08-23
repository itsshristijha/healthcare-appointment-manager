const { Sequelize } = require('sequelize');
const env = require('./env');

let sequelize;

if (env.databaseUrl) {
  sequelize = new Sequelize(env.databaseUrl, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: env.nodeEnv === 'production' ? { ssl: { require: true, rejectUnauthorized: false } } : {},
  });
} else {
  sequelize = new Sequelize(env.db.name, env.db.user, env.db.password, {
    host: env.db.host,
    port: env.db.port,
    dialect: 'postgres',
    logging: false,
  });
}

module.exports = sequelize;

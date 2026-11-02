const mongoose = require('mongoose');
const { config } = require('./env');

// MongoDB is the only datastore. MONGO_URI comes from the repo-root .env;
// MONGO_DB_NAME (used by the end-to-end tests) selects an isolated database.
module.exports = async function connectDB() {
  mongoose.set('strictQuery', true);
  const conn = await mongoose.connect(config.mongoUri, config.mongoDbName ? { dbName: config.mongoDbName } : {});
  if (!config.isTest) console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  return conn;
};

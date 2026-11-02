const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hackelite_db');
    console.log(`\x1b[32m✔ MongoDB Connected Successfully: ${conn.connection.host} / Database: ${conn.connection.name}\x1b[0m`);
  } catch (error) {
    console.error(`\x1b[31m✖ MongoDB Connection Failed: ${error.message}\x1b[0m`);
    process.exit(1);
  }
};

module.exports = connectDB;

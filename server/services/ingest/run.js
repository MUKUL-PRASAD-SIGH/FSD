const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });
const mongoose = require('mongoose');
const connectDB = require('../../config/db');
const { ingestDevpost } = require('./devpost');

// Runs every enabled source; used by `npm run ingest` and the hourly job in server.js.
async function runAll() {
  const results = {};
  try {
    results.devpost = await ingestDevpost();
  } catch (e) {
    results.devpost = `failed: ${e.message}`;
  }
  return results;
}

module.exports = { runAll };

if (require.main === module) {
  connectDB()
    .then(runAll)
    .then((r) => { console.log('Ingest finished:', r); return mongoose.disconnect(); })
    .catch((e) => { console.error(e); process.exit(1); });
}

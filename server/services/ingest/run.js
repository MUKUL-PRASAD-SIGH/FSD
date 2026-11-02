const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });
const mongoose = require('mongoose');
const connectDB = require('../../config/db');
const Listing = require('../../models/Listing');
const { upsertAll } = require('./common');

const SOURCES = [
  require('./sources/devpost'),
  require('./sources/unstop'),
  require('./sources/devfolio'),
  require('./sources/hackerearth'),
  ...require('./sources/contests'),
];

// Runs every enabled source independently, so one site being down never blocks the rest.
// ENABLED_SOURCES=unstop,devfolio limits the run. Sample (seed) rows are removed once live data lands.
async function runAll() {
  const only = (process.env.ENABLED_SOURCES || '').split(',').map((s) => s.trim()).filter(Boolean);
  const results = {};
  let live = 0;
  for (const src of SOURCES) {
    if (only.length && !only.includes(src.name)) continue;
    try {
      results[src.name] = await upsertAll(src.name, await src.fetchListings());
      live += results[src.name];
    } catch (e) {
      results[src.name] = `failed: ${e.message}`;
    }
  }
  await Listing.deleteMany({ deadline: { $lt: new Date() } });
  if (live > 0) await Listing.deleteMany({ source: 'seed' });
  return results;
}

module.exports = { runAll, SOURCES };

if (require.main === module) {
  connectDB()
    .then(runAll)
    .then((r) => { console.log('Ingest finished:', r); return mongoose.disconnect(); })
    .catch((e) => { console.error(e); process.exit(1); });
}

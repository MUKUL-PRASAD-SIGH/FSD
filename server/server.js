const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./utils/http');
const Listing = require('./models/Listing');

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',') : true }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/listings', require('./routes/listings'));
app.use('/api/me', require('./routes/me'));
app.use('/api/ask', require('./routes/ask'));
app.use(notFound);
app.use(errorHandler);

// The repo-root .env has PORT=5000 from the previous project; use API_PORT to override cleanly.
const PORT = process.env.API_PORT || 5050;

async function start() {
  await connectDB();
  if ((await Listing.countDocuments()) === 0) {
    console.log('No listings yet - run `npm run seed` for sample data and/or `npm run ingest` for live Devpost data.');
  }
  app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));

  // Hourly refresh of live sources (skipped with DISABLE_INGEST=true)
  if (process.env.DISABLE_INGEST !== 'true') {
    const { runAll } = require('./services/ingest/run');
    const tick = () => runAll().then((r) => console.log('ingest:', JSON.stringify(r))).catch((e) => console.error('ingest error', e.message));
    setTimeout(tick, 3000);
    setInterval(tick, 60 * 60 * 1000);
  }
}

if (require.main === module) start().catch((e) => { console.error('Startup failed:', e.message); process.exit(1); });
module.exports = app;

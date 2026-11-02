const express = require('express');
const { config, validate } = require('./config/env');
const connectDB = require('./config/db');
const { applySecurity } = require('./middleware/security');
const { sanitize } = require('./utils/sanitize');
const { notFound, errorHandler } = require('./utils/http');
const User = require('./models/User');
const Listing = require('./models/Listing');

function buildApp() {
  const app = express();
  applySecurity(app);
  app.use(express.json({ limit: '200kb' }));
  app.use(sanitize);

  app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/listings', require('./routes/listings'));
  app.use('/api/me', require('./routes/me'));
  app.use('/api/ask', require('./routes/ask'));
  app.use('/api/plan', require('./routes/plan'));
  app.use('/api/assistant', require('./routes/assistant'));
  app.use('/api/lister', require('./routes/lister'));
  app.use('/api/admin', require('./routes/admin'));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

// One-time data fixes for databases created by the previous version of the project.
async function migrate() {
  const users = User.collection;
  await users.updateMany({ role: 'student' }, { $set: { role: 'user' } });
  await users.updateMany({ password: { $exists: true }, hasPassword: { $exists: false } }, { $set: { hasPassword: true } });
  await Listing.collection.updateMany({ status: { $exists: false } }, { $set: { status: 'published' } });
}

// Creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD. Admins can never be created through the public API.
async function ensureAdmin() {
  if (!config.adminEmail || !config.adminPassword) return;
  const { checkPassword } = require('./utils/password');
  const existing = await User.findOne({ email: config.adminEmail });
  if (existing) {
    if (existing.role !== 'admin') { existing.role = 'admin'; existing.tokenVersion += 1; await existing.save(); console.log(`Promoted ${config.adminEmail} to admin`); }
    return;
  }
  const pw = checkPassword(config.adminPassword, { email: config.adminEmail });
  if (!pw.ok) { console.warn(`ADMIN_PASSWORD rejected by the password policy (${pw.problems.join('; ')}); admin not created.`); return; }
  await User.create({ name: 'Administrator', email: config.adminEmail, password: config.adminPassword, role: 'admin', emailVerified: true });
  console.log(`Created admin account for ${config.adminEmail}`);
}

// After new listings arrive: embed them for RAG, then notify users whose profile matches.
async function afterIngest() {
  const { indexListings } = require('./services/rag');
  const { runNotifier } = require('./services/notifier');
  const [indexed, notified] = [await indexListings(), await runNotifier()];
  return { indexed, notified };
}

async function start() {
  validate();
  await connectDB();
  await migrate();
  await ensureAdmin();
  const app = buildApp();
  const server = app.listen(config.port, () => console.log(`API listening on http://localhost:${config.port}`));

  if (!config.disableIngest) {
    const { runAll } = require('./services/ingest/run');
    const tick = async () => {
      try { console.log('ingest:', JSON.stringify(await runAll()), 'after:', JSON.stringify(await afterIngest())); }
      catch (e) { console.error('ingest error', e.message); }
    };
    setTimeout(tick, 3000);
    setInterval(tick, 60 * 60 * 1000);
  }
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
  return server;
}

if (require.main === module) start().catch((e) => { console.error('Startup failed:', e.message); process.exit(1); });
module.exports = { buildApp, migrate, ensureAdmin, afterIngest, start };

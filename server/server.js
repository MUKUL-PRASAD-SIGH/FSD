const express = require('express');
const { config, validate } = require('./config/env');
const connectDB = require('./config/db');
const { applySecurity } = require('./middleware/security');
const { sanitize } = require('./utils/sanitize');
const { notFound, errorHandler } = require('./utils/http');
const User = require('./models/User');
const Listing = require('./models/Listing');
const mongoose = require('mongoose');
const { requestId, accessLog, privateNoStore, compress } = require('./middleware/ops');

function buildApp() {
  const app = express();
  app.use(requestId);
  applySecurity(app);
  app.use(compress);
  app.use(accessLog);
  app.use(privateNoStore);
  app.use(express.json({ limit: '200kb' }));
  app.use(sanitize);

  // Liveness: the process is up. Readiness: it can actually serve (MongoDB connected). Orchestrators route on the latter.
  app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
  app.get('/api/health/ready', (_req, res) => {
    const db = mongoose.connection.readyState === 1;
    res.status(db ? 200 : 503).json({ ok: db, db: db ? 'up' : 'down', uptimeSec: Math.round(process.uptime()) });
  });
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/calendar', require('./routes/calendar'));
  app.use('/api/network', require('./routes/network'));
  app.use('/api/teams', require('./routes/teams'));
  app.use('/api/chat', require('./routes/chat'));
  app.use('/api/listings', require('./routes/listingAgent'));
  app.use('/api/listings', require('./routes/listings'));
  app.use('/api/me', require('./routes/me'));
  app.use('/api/ask', require('./routes/ask'));
  app.use('/api/plan', require('./routes/plan'));
  app.use('/api/assistant', require('./routes/assistant'));
  app.use('/api/lister', require('./routes/lister'));
  app.use('/api/admin', require('./routes/admin'));
  if (process.env.SERVE_CLIENT === 'true') serveClient(app);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

// Optional single-process deployment: serve the built React app (client/dist) from this server.
// The API keeps its locked-down CSP; HTML pages get a CSP that allows only this origin, Google Identity Services
// and the one inline theme script (by hash, so no 'unsafe-inline' for scripts).
function serveClient(app) {
  const fs = require('fs');
  const path = require('path');
  const crypto = require('crypto');
  const dist = path.join(__dirname, '..', 'client', 'dist');
  const indexFile = path.join(dist, 'index.html');
  if (!fs.existsSync(indexFile)) { console.warn('SERVE_CLIENT=true but client/dist is missing; run `npm run build` in client/'); return; }
  const html = fs.readFileSync(indexFile, 'utf8');
  const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`);
  const csp = [
    "default-src 'self'",
    `script-src 'self' https://accounts.google.com/gsi/client ${hashes.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
    "img-src 'self' data: https://*.googleusercontent.com",
    "connect-src 'self' https://accounts.google.com/gsi/",
    "frame-src https://accounts.google.com/gsi/",
    "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'",
  ].join('; ');
  const pageHeaders = (res) => { res.setHeader('Content-Security-Policy', csp); res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups'); };
  app.use(express.static(dist, { index: false, maxAge: '7d', setHeaders: (res, file) => { if (file.endsWith('.html')) pageHeaders(res); } }));
  app.get(/^\/(?!api\/).*/, (_req, res) => { pageHeaders(res); res.setHeader('Cache-Control', 'no-cache'); res.type('html').send(html); });
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
  require('./services/realtime').init(server); // live chat and notifications (Socket.IO on the same port)

  if (!config.disableIngest) {
    const { runAll } = require('./services/ingest/run');
    let running = false; // never overlap two syncs in one process
    const tick = async () => {
      if (running) return;
      running = true;
      try { const r = await runAll(); console.log('ingest:', JSON.stringify(r.summary), 'after:', JSON.stringify(await afterIngest())); }
      catch (e) { console.error('ingest error', e.message); }
      finally { running = false; }
    };
    setTimeout(tick, 3000).unref();
    setInterval(tick, (Number(process.env.INGEST_INTERVAL_MIN) || 60) * 60 * 1000).unref();
  }
  // Email reminders for tracked deadlines (opt-in per user). Same single-instance caveat as ingestion.
  if (!config.disableIngest) {
    const { runReminders } = require('./services/reminders');
    let reminding = false;
    const remind = async () => { if (reminding) return; reminding = true; try { const r = await runReminders(); if (r.sent) console.log('reminders sent:', r.sent); } catch (e) { console.error('reminders error', e.message); } finally { reminding = false; } };
    setTimeout(remind, 45000).unref();
    setInterval(remind, 15 * 60 * 1000).unref();
  }
  // Graceful shutdown: stop accepting, let in-flight requests finish, close MongoDB, then exit (hard stop after 10 s).
  let closing = false;
  const shutdown = (sig) => {
    if (closing) return; closing = true;
    console.log(`${sig} received, shutting down`);
    setTimeout(() => process.exit(1), 10000).unref();
    server.close(async () => { try { await require('./services/realtime').close(); await mongoose.disconnect(); } finally { process.exit(0); } });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM')); process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (e) => console.error('unhandledRejection:', e));
  return server;
}

if (require.main === module) start().catch((e) => { console.error('Startup failed:', e.message); process.exit(1); });
module.exports = { buildApp, migrate, ensureAdmin, afterIngest, start };

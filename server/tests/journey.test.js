// The complete product journey, in-process (part of `npm test`). Same script as the live runner (`npm run e2e`), see helpers/journey.js.
process.env.NODE_ENV = 'test';
process.env.MONGO_DB_NAME = 'hackelite_journey_test';
process.env.JWT_SECRET = process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32 ? process.env.JWT_SECRET : 'journey-test-secret-journey-test-secret-0123456789';
process.env.ADMIN_EMAIL = 'admin-journey@example.com';
process.env.ADMIN_PASSWORD = 'Adm1n-Journey-Passw0rd!x';
process.env.PRO_ACTIVATION_KEYS = 'JOURNEY-PRO-KEY';
process.env.GEMINI_API_KEY = ''; process.env.SMTP_URL = ''; process.env.GOOGLE_CLIENT_ID = '';
process.env.DISABLE_INGEST = 'true'; process.env.EMBEDDINGS_PROVIDER = 'local';

const test = require('node:test');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { buildApp, migrate, ensureAdmin } = require('../server');
const realtime = require('../services/realtime');
const { outbox } = require('../services/mailer');
const { createJourney } = require('./helpers/journey');

test('full product journey: accounts → discovery → resume & recommendations → tracker & calendar → agent → network, chat, teams → reminders → admin → privacy → erasure', { timeout: 240000 }, async (t) => {
  await connectDB(); await mongoose.connection.dropDatabase(); await migrate(); await ensureAdmin();
  const server = buildApp().listen(0); realtime.init(server);
  const journey = createJourney({
    base: `http://127.0.0.1:${server.address().port}`, mode: 'in-process',
    mail: { find: (to, re) => [...outbox].reverse().find((m) => m.to === to && re.test(m.subject))?.text || null },
    admin: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }, proKey: 'JOURNEY-PRO-KEY',
    resumePdf: path.join(__dirname, 'fixtures', 'resume.pdf'),
  });
  let checks = 0;
  const step = async (label, fn) => { try { await fn(); checks += 1; console.log(`      ✔ ${label}`); } catch (e) { e.message = `${label}: ${e.message}`; throw e; } };
  try {
    for (const ph of journey.phases) await t.test(ph.name, async () => { await ph.run(step); });
    console.log(`\n      ${checks} journey checks passed`);
  } finally {
    journey.close(); await realtime.close(); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); server.close();
  }
});

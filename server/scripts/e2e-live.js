#!/usr/bin/env node
// Black-box end-to-end run in the terminal.
//   npm run e2e            (from the repo root or from server/)
//
// 1. boots the REAL server as a separate process (`node server.js`) on a free port with an isolated, throw-away database
//    (hackelite_live_e2e), a known admin, ingestion off and mail printed instead of sent
// 2. waits until /api/health/ready says MongoDB is connected
// 3. runs the whole product journey over HTTP and WebSocket (tests/helpers/journey.js), printing every check
// 4. stops the server (graceful where the OS allows), drops the database, and exits non-zero on any failure
//
// Needs a reachable MongoDB (MONGO_URI, default mongodb://127.0.0.1:27017; `npm run db` starts one). Never touches your real
// database, real email, Google or Gemini: those variables are blanked for the child process.
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

const SERVER_DIR = path.join(__dirname, '..');
const DB_NAME = 'hackelite_live_e2e';
const ADMIN = { email: 'admin-live@example.com', password: 'Adm1n-Live-Passw0rd!x' };
const PRO_KEY = 'LIVE-E2E-PRO-KEY';
const SECRET = 'live-e2e-secret-live-e2e-secret-0123456789abcdef';

// the parent process shares the same isolated settings so it can seed data and call services directly
Object.assign(process.env, { NODE_ENV: 'test', MONGO_DB_NAME: DB_NAME, JWT_SECRET: SECRET, ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD: ADMIN.password, PRO_ACTIVATION_KEYS: PRO_KEY, GEMINI_API_KEY: '', SMTP_URL: '', GOOGLE_CLIENT_ID: '', EMBEDDINGS_PROVIDER: 'local', HIBP_CHECK: 'off' });

const c = process.stdout.isTTY ? { g: '\x1b[32m', r: '\x1b[31m', d: '\x1b[2m', b: '\x1b[1m', y: '\x1b[33m', x: '\x1b[0m' } : { g: '', r: '', d: '', b: '', y: '', x: '' };
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); }); s.on('error', rej); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const mongoose = require('mongoose');
  const connectDB = require('../config/db');
  const { createJourney } = require('../tests/helpers/journey');

  // clean slate BEFORE the server boots, so the server itself creates its indexes and its admin account on a fresh database
  await connectDB(); await mongoose.connection.dropDatabase();

  const port = await freePort();
  const out = { text: '' };
  console.log(`${c.b}HackElite live end-to-end run${c.x}  ${c.d}(real server process, isolated database "${DB_NAME}")${c.x}\n`);

  const child = spawn(process.execPath, ['server.js'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env, NODE_ENV: 'development', API_PORT: String(port), PORT: String(port), CLIENT_ORIGIN: `http://localhost:${port}`, APP_URL: `http://localhost:${port}`,
      MONGO_DB_NAME: DB_NAME, JWT_SECRET: SECRET, ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD: ADMIN.password, PRO_ACTIVATION_KEYS: PRO_KEY,
      DISABLE_INGEST: 'true', DISABLE_RATE_LIMITS: '1', SERVE_CLIENT: 'false', SMTP_URL: '', GOOGLE_CLIENT_ID: '', GEMINI_API_KEY: '', EMBEDDINGS_PROVIDER: 'local', HIBP_CHECK: 'off',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let exited = null;
  child.stdout.on('data', (d) => { out.text += d; });
  child.stderr.on('data', (d) => { out.text += d; });
  child.on('exit', (code, sig) => { exited = { code, sig }; });

  const base = `http://127.0.0.1:${port}`;
  const failures = [];
  let passed = 0;
  const started = Date.now();
  let journey;
  try {
    for (let i = 0; i < 160; i += 1) { // up to ~40 s
      if (exited) throw new Error(`the server exited during start-up:\n${out.text.slice(-1500)}`);
      try { const r = await fetch(`${base}/api/health/ready`); if (r.ok) break; } catch { /* not listening yet */ }
      await sleep(250);
      if (i === 159) throw new Error(`the server did not become ready:\n${out.text.slice(-1500)}`);
    }
    console.log(`${c.g}✔${c.x} server process is up on ${base} ${c.d}(pid ${child.pid})${c.x}\n`);
    await sleep(500); // let the server finish creating its indexes and admin account

    const mailFind = (to, re) => {
      const esc = to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const blocks = [...out.text.matchAll(new RegExp(`\\[mail:dev\\] to=${esc} subject="([^"]*)"\\n([\\s\\S]*?)\\n\\n`, 'g'))].filter((m) => re.test(m[1]));
      return blocks.length ? blocks[blocks.length - 1][2] : null;
    };
    journey = createJourney({ base, mode: 'live', mail: { find: mailFind }, admin: ADMIN, proKey: PRO_KEY, resumePdf: path.join(SERVER_DIR, 'tests', 'fixtures', 'resume.pdf') });

    const only = process.env.E2E_PHASES ? process.env.E2E_PHASES.split(',').map((x) => x.trim()) : null; // e.g. E2E_PHASES=2,4 (debugging: later phases may depend on earlier ones)
    for (const ph of journey.phases.filter((p) => !only || only.includes(p.name.split(' ')[0]))) {
      console.log(`${c.b}${ph.name}${c.x}`);
      const skip = (process.env.E2E_SKIP || '').split('|').filter(Boolean); // debugging: skip steps whose label contains any of these
      const step = async (label, fn) => {
        if (skip.some((x) => label.includes(x))) { console.log(`  ${c.y}↷ skipped${c.x} ${label}`); return; }
        const t0 = Date.now();
        try { await fn(); passed += 1; console.log(`  ${c.g}✔${c.x} ${label} ${c.d}(${Date.now() - t0} ms)${c.x}`); }
        catch (e) { failures.push({ phase: ph.name, label, error: e }); console.log(`  ${c.r}✖ ${label}${c.x}\n    ${c.r}${String(e.message).split('\n').join('\n    ')}${c.x}`); throw e; }
      };
      try { await ph.run(step); } catch { break; } // later phases depend on earlier state: stop at the first failure
      console.log('');
    }
  } catch (e) {
    failures.push({ phase: 'setup', label: 'start the run', error: e });
    console.log(`${c.r}✖ ${e.message}${c.x}`);
  }

  // ---- tidy up: stop sockets, stop the server, drop the database
  try { journey?.close(); } catch { /* ignore */ }
  let graceful = 'skipped (Windows cannot deliver SIGTERM; the server was stopped forcibly)';
  if (!exited) {
    child.kill('SIGTERM');
    for (let i = 0; i < 40 && !exited; i += 1) await sleep(250);
    if (!exited) { child.kill('SIGKILL'); graceful = `${c.r}did not exit within 10 s${c.x}`; failures.push({ phase: 'shutdown', label: 'graceful shutdown', error: new Error('server ignored SIGTERM') }); }
    else if (process.platform !== 'win32') { graceful = exited.code === 0 ? `${c.g}exited cleanly (code 0)${c.x}` : `${c.r}exit code ${exited.code}${c.x}`; if (exited.code !== 0) failures.push({ phase: 'shutdown', label: 'graceful shutdown', error: new Error(`exit code ${exited.code}`) }); }
  }
  try { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); } catch { /* not connected */ }

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`${c.b}Shutdown:${c.x} ${graceful}`);
  if (failures.length) {
    console.log(`\n${c.r}${c.b}FAILED${c.x}  ${passed} checks passed, ${failures.length} failed in ${secs}s`);
    if (out.text) console.log(`${c.d}--- last server output ---\n${out.text.slice(-(process.env.E2E_VERBOSE ? 20000 : 1200))}${c.x}`);
    process.exit(1);
  }
  console.log(`\n${c.g}${c.b}ALL ${passed} CHECKS PASSED${c.x} in ${secs}s  ${c.d}(accounts, discovery, resume + recommendations, tracker + calendar, agent, network + live chat + teams, reminders, admin, privacy, erasure)${c.x}`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });

// SMS / WhatsApp reminders and phone verification against a FAKE Twilio (local HTTP server), so no real texts are sent.
process.env.NODE_ENV = 'test';
process.env.MONGO_DB_NAME = 'hackelite_sms_test';
process.env.JWT_SECRET = process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32 ? process.env.JWT_SECRET : 'sms-test-secret-sms-test-secret-sms-test-0123456';
process.env.ADMIN_EMAIL = ''; process.env.ADMIN_PASSWORD = ''; process.env.ADMIN_EMAILS = '';
process.env.GEMINI_API_KEY = ''; process.env.SMTP_URL = ''; process.env.GOOGLE_CLIENT_ID = '';
process.env.DISABLE_INGEST = 'true'; process.env.EMBEDDINGS_PROVIDER = 'local'; process.env.HIBP_CHECK = 'off';
process.env.TWILIO_ACCOUNT_SID = 'AC00000000000000000000000000000000';
process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';
process.env.TWILIO_VERIFY_SERVICE_SID = 'VA00000000000000000000000000000000';
process.env.TWILIO_MESSAGING_SERVICE_SID = 'MG00000000000000000000000000000000';
process.env.TWILIO_WHATSAPP_FROM = '+14155238886';
process.env.SMS_DAILY_CAP_PER_USER = '2';
process.env.APP_URL = 'https://app.example';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const crypto = require('crypto');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { buildApp, migrate } = require('../server');
const User = require('../models/User');
const Listing = require('../models/Listing');
const Saved = require('../models/Saved');
const ReminderLog = require('../models/ReminderLog');
const { runReminders } = require('../services/reminders');

const PW = 'Str0ng-Passw0rd!9';
const DAY = 86400000;
let server; let base; let fake; let n = 0;
const sent = []; const verifications = [];

test.before(async () => {
  // Fake Twilio: Verify start/check and the Messages API
  fake = http.createServer((req, res) => {
    let raw = ''; req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const p = Object.fromEntries(new URLSearchParams(raw));
      const auth = Buffer.from(String(req.headers.authorization || '').replace('Basic ', ''), 'base64').toString();
      res.setHeader('Content-Type', 'application/json');
      if (auth !== `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`) { res.statusCode = 401; return res.end(JSON.stringify({ message: 'bad auth' })); }
      if (req.url.endsWith('/Verifications')) { verifications.push(p); return res.end(JSON.stringify({ status: 'pending' })); }
      if (req.url.endsWith('/VerificationCheck')) return res.end(JSON.stringify({ status: p.Code === '123456' ? 'approved' : 'pending' }));
      if (req.url.endsWith('/Messages.json')) { sent.push(p); return res.end(JSON.stringify({ sid: `SM${sent.length}` })); }
      res.statusCode = 404; return res.end('{}');
    });
  });
  await new Promise((r) => fake.listen(0, '127.0.0.1', r));
  process.env.TWILIO_TEST_BASE = `http://127.0.0.1:${fake.address().port}`;
  await connectDB(); await mongoose.connection.dropDatabase(); await migrate();
  server = buildApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); server.close(); fake.close(); });

const call = async (method, p, { token, body, form, headers = {} } = {}) => {
  const h = { ...headers }; if (token) h.Authorization = `Bearer ${token}`;
  let payload;
  if (body) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  if (form) { h['Content-Type'] = 'application/x-www-form-urlencoded'; payload = new URLSearchParams(form).toString(); }
  const r = await fetch(base + p, { method, headers: h, body: payload });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* xml or empty */ }
  return { status: r.status, body: json, text };
};
const register = async (name) => {
  const r = await call('POST', '/api/auth/register', { body: { name, email: `s${Date.now()}${n++}@example.com`, password: PW } });
  return { token: r.body.token, id: r.body.user.id };
};
const sign = (url, params) => crypto.createHmac('sha1', process.env.TWILIO_AUTH_TOKEN).update(url + Object.keys(params).sort().map((k) => `${k}${params[k]}`).join('')).digest('base64');

let ana;
test('config advertises the channels, phone verification needs the right code', async () => {
  assert.deepEqual((await call('GET', '/api/auth/config')).body.smsChannels, ['sms', 'whatsapp']);
  ana = await register('Ana Iyer');
  assert.equal((await call('POST', '/api/me/phone/start', { token: ana.token, body: { phone: '12345' } })).status, 400);
  let r = await call('POST', '/api/me/phone/start', { token: ana.token, body: { phone: '98765 43210' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.sentTo, '+91•••••210', 'the number is masked in responses');
  assert.equal(verifications.at(-1).To, '+919876543210');
  assert.equal((await call('POST', '/api/me/phone/verify', { token: ana.token, body: { code: '000000' } })).status, 400);
  assert.equal((await call('PUT', '/api/me/profile', { token: ana.token, body: { notify: { smsReminders: true } } })).status, 400, 'cannot opt in before verifying');
  r = await call('POST', '/api/me/phone/verify', { token: ana.token, body: { code: '123456' } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.user.phone, { number: '+919876543210', verified: true, channel: 'sms', pending: false });
  assert.equal(r.body.user.notify.smsReminders, true);
});

test('one verified number per account, and code requests are rate limited', async () => {
  const ben = await register('Ben Roy');
  assert.equal((await call('POST', '/api/me/phone/start', { token: ben.token, body: { phone: '+91 98765 43210' } })).status, 409);
  for (let i = 0; i < 3; i++) assert.equal((await call('POST', '/api/me/phone/start', { token: ben.token, body: { phone: `+91 9123456${780 + i}` } })).status, 200);
  assert.equal((await call('POST', '/api/me/phone/start', { token: ben.token, body: { phone: '+91 9123456790' } })).status, 429);
});

test('reminders: an SMS at 1 day before, never twice, separate from email, capped per day', async () => {
  const now = new Date();
  const ls = await Promise.all(['A', 'B', 'C'].map((x, i) => Listing.create({ title: `Text Hack ${x}`, type: 'HACKATHON', url: `https://x.example/${x}`, source: 'manual', platform: 'Manual', mode: 'ONLINE', fee: 'Free', deadline: new Date(now.getTime() + DAY + (i + 1) * 60000) })));
  for (const l of ls) await Saved.create({ user: ana.id, listing: l._id, status: 'saved' });
  await User.updateOne({ _id: ana.id }, { $set: { emailVerified: true, 'notify.emailReminders': true } });
  const later = new Date(now.getTime() + 5 * 60000); // just past the 1-day mark for all three
  const before = sent.length;
  await runReminders({ now: later });
  const texts = sent.slice(before);
  assert.equal(texts.length, 2, 'daily cap of 2 texts');
  assert.equal(texts[0].To, '+919876543210');
  assert.equal(texts[0].MessagingServiceSid, process.env.TWILIO_MESSAGING_SERVICE_SID);
  assert.match(texts[0].Body, /closes in 1 day.*Reply STOP/);
  assert.equal(await ReminderLog.countDocuments({ user: ana.id, channel: 'email' }), 3, 'emails are not capped or blocked by texts');
  await runReminders({ now: later });
  assert.equal(sent.length, before + 2, 'idempotent: nothing is sent twice');
});

test('WhatsApp channel uses the WhatsApp sender', async () => {
  await User.updateOne({ _id: ana.id }, { $set: { 'phone.channel': 'whatsapp' } });
  await ReminderLog.deleteMany({ user: ana.id, channel: { $in: ['sms', 'whatsapp'] } });
  const before = sent.length;
  await runReminders({ now: new Date(Date.now() + 5 * 60000) });
  assert.ok(sent.length > before);
  assert.equal(sent.at(-1).To, 'whatsapp:+919876543210');
  assert.equal(sent.at(-1).From, 'whatsapp:+14155238886');
});

test('inbound STOP / START webhook: signature required', async () => {
  const url = 'https://app.example/api/sms/inbound';
  const stop = { From: '+919876543210', Body: 'STOP' };
  assert.equal((await call('POST', '/api/sms/inbound', { form: stop, headers: { 'X-Twilio-Signature': 'forged' } })).status, 403);
  let r = await call('POST', '/api/sms/inbound', { form: stop, headers: { 'X-Twilio-Signature': sign(url, stop) } });
  assert.equal(r.status, 200);
  assert.match(r.text, /reminders are off/);
  assert.equal((await User.findById(ana.id)).notify.smsReminders, false);
  const start = { From: 'whatsapp:+919876543210', Body: 'start' };
  r = await call('POST', '/api/sms/inbound', { form: start, headers: { 'X-Twilio-Signature': sign(url, start) } });
  assert.equal((await User.findById(ana.id)).notify.smsReminders, true);
});

test('removing the number turns text reminders off', async () => {
  const r = await call('DELETE', '/api/me/phone', { token: ana.token });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.phone.verified, false);
  assert.equal(r.body.user.notify.smsReminders, false);
});

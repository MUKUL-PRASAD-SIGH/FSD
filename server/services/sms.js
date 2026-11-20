// SMS and WhatsApp through Twilio's REST API (no SDK, so no extra dependency).
//   - phone verification with Twilio Verify (one-time code by SMS or WhatsApp)
//   - outgoing messages through a Messaging Service (recommended; handles Indian sender IDs / DLT) or a From number
//   - inbound webhook signatures are checked with the auth token (HMAC-SHA1, Twilio's scheme)
// Without credentials nothing is sent: in development messages are printed and kept in `outbox` so the flow can be tried.
const crypto = require('crypto');
const { config } = require('../config/env');

const t = () => config.twilio;
// Test-only override so tests can point at a local fake Twilio; ignored outside NODE_ENV=test (no config-driven SSRF)
const apiBase = () => (config.isTest && process.env.TWILIO_TEST_BASE) || 'https://api.twilio.com';
const verifyBase = () => (config.isTest && process.env.TWILIO_TEST_BASE) || 'https://verify.twilio.com';

const hasAccount = () => !!(t().accountSid && t().authToken);
const canVerify = () => hasAccount() && !!t().verifyServiceSid;
const canSend = (channel = 'sms') => hasAccount() && (channel === 'whatsapp' ? !!t().whatsappFrom : !!(t().messagingServiceSid || t().smsFrom));
const enabled = () => canVerify() && (canSend('sms') || canSend('whatsapp'));
const channels = () => ['sms', 'whatsapp'].filter((c) => canSend(c));

const outbox = [];

// "98765 43210" / "098765-43210" / "+91 98765 43210" -> "+919876543210". Returns null when it can't be a phone number.
function normalizePhone(input) {
  let s = String(input || '').replace(/[\s().-]/g, '');
  if (!s) return null;
  if (s.startsWith('00')) s = `+${s.slice(2)}`;
  if (!s.startsWith('+')) {
    s = s.replace(/^0+/, '');
    if (!/^\d{6,14}$/.test(s)) return null;
    s = `${t().defaultCountryCode}${s}`;
  }
  if (!/^\+[1-9]\d{7,14}$/.test(s)) return null;
  if (s.startsWith('+91') && !/^\+91[6-9]\d{9}$/.test(s)) return null; // Indian mobiles: 10 digits starting 6-9
  return s;
}
const mask = (p) => (p ? `${p.slice(0, 3)}•••••${p.slice(-3)}` : '');

async function call(base, path, params) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${t().accountSid}:${t().authToken}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.message || `Twilio ${res.status}`);
    err.twilioCode = body.code; err.status = res.status >= 500 ? 502 : 400;
    throw err;
  }
  return body;
}

async function startVerification(phone, channel = 'sms') {
  if (!canVerify()) throw Object.assign(new Error('Phone verification is not set up on this server yet.'), { status: 503, code: 'SMS_NOT_CONFIGURED' });
  const r = await call(verifyBase(), `/v2/Services/${t().verifyServiceSid}/Verifications`, { To: phone, Channel: channel === 'whatsapp' ? 'whatsapp' : 'sms' });
  return { status: r.status };
}

async function checkVerification(phone, code) {
  if (!canVerify()) throw Object.assign(new Error('Phone verification is not set up on this server yet.'), { status: 503, code: 'SMS_NOT_CONFIGURED' });
  const r = await call(verifyBase(), `/v2/Services/${t().verifyServiceSid}/VerificationCheck`, { To: phone, Code: code });
  return r.status === 'approved';
}

async function send({ to, body, channel = 'sms' }) {
  const text = String(body).slice(0, 640);
  if (!canSend(channel)) {
    outbox.push({ to, body: text, channel, at: new Date() });
    if (outbox.length > 200) outbox.shift();
    if (!config.isProd && !config.isTest) console.log(`[sms:dev] ${channel} to=${mask(to)} ${text}`);
    return { sent: false, reason: 'not configured' };
  }
  const params = { To: channel === 'whatsapp' ? `whatsapp:${to}` : to, Body: text };
  if (channel === 'whatsapp') params.From = `whatsapp:${t().whatsappFrom}`;
  else if (t().messagingServiceSid) params.MessagingServiceSid = t().messagingServiceSid;
  else params.From = t().smsFrom;
  const r = await call(apiBase(), `/2010-04-01/Accounts/${t().accountSid}/Messages.json`, params);
  return { sent: true, sid: r.sid };
}

// X-Twilio-Signature = base64(HMAC-SHA1(authToken, fullUrl + concat(sorted key+value of POST params)))
function validSignature(signature, url, params) {
  if (!t().authToken || typeof signature !== 'string') return false;
  const data = url + Object.keys(params).sort().map((k) => `${k}${params[k]}`).join('');
  const expected = crypto.createHmac('sha1', t().authToken).update(data).digest('base64');
  const a = Buffer.from(expected); const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { normalizePhone, mask, startVerification, checkVerification, send, validSignature, enabled, canVerify, canSend, channels, outbox };

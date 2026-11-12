// Real end-to-end checks for every external integration. Each check makes an actual request with the configured
// credentials and reports { name, configured, ok, detail }. Nothing here is mocked: an unconfigured integration is
// reported as "not configured", never as working. Secrets are never included in the output.
const mongoose = require('mongoose');
const { config } = require('../config/env');

const timed = async (fn) => { const t = Date.now(); try { const detail = await fn(); return { ok: true, detail, ms: Date.now() - t }; } catch (e) { return { ok: false, detail: String(e.message || e).replace(/\s+/g, ' ').slice(0, 300), ms: Date.now() - t }; } };

const checks = {
  mongodb: {
    configured: () => !!config.mongoUri,
    run: async () => { await mongoose.connection.db.admin().ping(); return `connected to ${mongoose.connection.name}`; },
  },
  jwt: {
    configured: () => !!config.jwtSecret,
    run: async () => { if (config.jwtSecret.length < 32) throw new Error('JWT_SECRET shorter than 32 characters'); return 'secret length ok'; },
  },
  admin_bootstrap: {
    configured: () => !!(config.adminEmail && config.adminPassword),
    run: async () => {
      const User = require('../models/User');
      const n = await User.countDocuments({ role: 'admin' });
      if (!n) throw new Error('no admin account exists (ADMIN_PASSWORD may have been rejected by the password policy; see server log)');
      return `${n} admin account(s)`;
    },
  },
  pro_keys: {
    configured: () => config.proKeys.length > 0,
    run: async () => {
      if (config.isProd && config.proKeys.includes('HACKELITE-PRO-DEMO-2026')) throw new Error('the public demo key is enabled in production');
      return `${config.proKeys.length} key(s) configured`;
    },
  },
  google_oauth: {
    configured: () => !!config.googleClientId,
    // A full sign-in needs a person in a browser; this checks the client id shape and that Google's signing keys are reachable.
    run: async () => {
      if (!/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(config.googleClientId)) throw new Error('GOOGLE_CLIENT_ID does not look like a Web OAuth client id (…apps.googleusercontent.com)');
      const r = await fetch('https://www.googleapis.com/oauth2/v3/certs', { signal: AbortSignal.timeout(10000) });
      if (!r.ok) throw new Error(`Google certs endpoint ${r.status}`);
      return 'client id format ok; Google signing keys reachable. Finish by signing in with Google in the browser.';
    },
  },
  gemini_generate: {
    configured: () => !!config.geminiKey,
    run: async () => {
      const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.geminiKey },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Reply with the single word: pong' }] }], generationConfig: { maxOutputTokens: 10, thinkingConfig: { thinkingBudget: 0 } } }),
        signal: AbortSignal.timeout(30000),
      });
      const body = await r.text();
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${body.slice(0, 200)}`);
      const text = JSON.parse(body).candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim();
      if (!text) throw new Error('no text in response');
      return `${model} answered "${text.slice(0, 40)}"`;
    },
  },
  gemini_embeddings: {
    configured: () => !!config.geminiKey,
    run: async () => {
      const { geminiEmbed, GEMINI_EMBED_MODEL } = require('./embeddings');
      const [v] = await geminiEmbed(['hackathon for machine learning students']);
      if (!Array.isArray(v) || !v.length) throw new Error('empty embedding');
      return `${GEMINI_EMBED_MODEL} returned ${v.length} dimensions${config.embeddingsProvider === 'gemini' ? '' : ' (not active: set EMBEDDINGS_PROVIDER=gemini to use it)'}`;
    },
  },
  smtp: {
    configured: () => !!config.smtpUrl,
    run: async () => {
      const t = require('nodemailer').createTransport(config.smtpUrl);
      await t.verify();
      const to = process.env.SMTP_TEST_TO;
      if (to) { await t.sendMail({ from: config.mailFrom, to, subject: 'HackElite SMTP test', text: 'If you can read this, SMTP is working.' }); return `login ok; test email sent to ${to}`; }
      return 'server accepted the login (set SMTP_TEST_TO=you@example.com to also send a test email)';
    },
  },
  kaggle: {
    configured: () => !!(process.env.KAGGLE_USERNAME && process.env.KAGGLE_KEY),
    run: async () => {
      const auth = 'Basic ' + Buffer.from(`${process.env.KAGGLE_USERNAME}:${process.env.KAGGLE_KEY}`).toString('base64');
      const r = await fetch('https://www.kaggle.com/api/v1/competitions/list?page=1', { headers: { Authorization: auth }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return `${(await r.json()).length} competitions on page 1`;
    },
  },
  clist: {
    configured: () => !!(process.env.CLIST_USERNAME && process.env.CLIST_API_KEY),
    run: async () => {
      const r = await fetch('https://clist.by/api/v4/contest/?upcoming=true&limit=1&format=json', { headers: { Authorization: `ApiKey ${process.env.CLIST_USERNAME}:${process.env.CLIST_API_KEY}` }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return `${(await r.json()).meta?.total_count ?? '?'} upcoming contests`;
    },
  },
};

async function checkAll(only) {
  const out = [];
  for (const [name, c] of Object.entries(checks)) {
    if (only && !only.includes(name)) continue;
    if (!c.configured()) { out.push({ name, configured: false, ok: null, detail: 'not configured' }); continue; }
    out.push({ name, configured: true, ...(await timed(c.run)) });
  }
  return out;
}

module.exports = { checkAll, checks };

// Single place that reads and validates environment variables.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

const isProd = process.env.NODE_ENV === 'production';
const list = (v) => (v || '').split(',').map((s) => s.trim()).filter(Boolean);

const config = {
  isProd,
  isTest: process.env.NODE_ENV === 'test',
  port: Number(process.env.PORT) || Number(process.env.API_PORT) || 5050,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hackelite_db',
  mongoUriConfigured: !!process.env.MONGO_URI,
  // True when the database lives on this machine (the dev default or a localhost URI), so only this computer's users share it.
  dbIsLocal: /^mongodb:\/\/([^@/]*@)?(127\.0\.0\.1|localhost|\[::1\])([:/]|$)/i.test(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hackelite_db'),
  mongoDbName: process.env.MONGO_DB_NAME || undefined, // lets tests use an isolated database
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigins: list(process.env.CLIENT_ORIGIN || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173'),
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  geminiKey: process.env.GEMINI_API_KEY || '',
  embeddingsProvider: process.env.EMBEDDINGS_PROVIDER || 'local', // local | gemini
  proKeys: list(process.env.PRO_ACTIVATION_KEYS),
  // Paid plans are switched off by default: every signed-in user gets every feature. Set PLANS_ENABLED=true to bring the
  // Free/Pro split back (the plan code lives on unchanged in routes/plan.js and client/src/premium/).
  plansEnabled: process.env.PLANS_ENABLED === 'true',
  adminEmail: (process.env.ADMIN_EMAIL || '').toLowerCase(),
  // Extra admins (and recipients of admin alert emails). Accounts with these emails become admins only once the email is
  // verified (email link or Google sign-in), so nobody can claim admin by registering someone else's address.
  adminEmails: [...new Set([...list(process.env.ADMIN_EMAILS).map((e) => e.toLowerCase()), (process.env.ADMIN_EMAIL || '').toLowerCase()].filter(Boolean))],
  adminPassword: process.env.ADMIN_PASSWORD || '',
  smtpUrl: process.env.SMTP_URL || '',
  // Twilio (optional): SMS / WhatsApp deadline reminders and phone verification. See docs/ENV_SETUP.md "SMS and WhatsApp".
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    verifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID || '', // Twilio Verify service for phone OTPs
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID || '', // preferred sender for SMS (handles sender IDs / DLT)
    smsFrom: process.env.TWILIO_SMS_FROM || '', // alternative to a messaging service: a Twilio number or approved sender ID
    whatsappFrom: process.env.TWILIO_WHATSAPP_FROM || '', // e.g. +14155238886 (sandbox) or your approved WhatsApp sender
    defaultCountryCode: process.env.SMS_DEFAULT_COUNTRY_CODE || '+91',
    dailyCap: Number(process.env.SMS_DAILY_CAP_PER_USER) || 4,
  },
  mailFrom: process.env.MAIL_FROM || 'HackElite <no-reply@hackelite.local>',
  appUrl: process.env.APP_URL || list(process.env.CLIENT_ORIGIN || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173')[0],
  disableIngest: process.env.DISABLE_INGEST === 'true',
};

// Fail fast on unsafe production config instead of silently running insecure.
function validate() {
  const problems = [];
  if (config.jwtSecret.length < 32) problems.push('JWT_SECRET must be at least 32 characters');
  if (config.jwtSecret === 'hackelite_super_secret_jwt_key_2026') problems.push('JWT_SECRET is the public default from the old project');
  if (isProd && !config.mongoUriConfigured) problems.push('MONGO_URI must point to the persistent shared MongoDB used by this deployment');
  if (isProd && config.plansEnabled && !config.proKeys.length) problems.push('PRO_ACTIVATION_KEYS must be set in production when PLANS_ENABLED=true');
  if (isProd && config.plansEnabled && config.proKeys.includes('HACKELITE-PRO-DEMO-2026')) problems.push('PRO_ACTIVATION_KEYS contains the public demo key');
  if (isProd && config.clientOrigins.includes('*')) problems.push('CLIENT_ORIGIN must not be *');
  // Real users need password resets and verification links, which need email
  if (isProd && !config.smtpUrl) problems.push('SMTP_URL must be set in production (password reset, email verification, admin alerts)');
  if (isProd && !/^https:\/\//.test(config.appUrl)) problems.push('APP_URL must be the public https:// address in production (it is used in emailed links)');
  if (isProd && !config.adminEmails.length) console.warn('WARNING: no ADMIN_EMAILS/ADMIN_EMAIL set: nobody receives admin alerts');
  if (problems.length) {
    const msg = `Invalid configuration:\n - ${problems.join('\n - ')}`;
    if (isProd || config.isTest) throw new Error(msg);
    console.warn(`WARNING: ${msg}`);
  }
}

module.exports = { config, validate };

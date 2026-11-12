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
  mongoDbName: process.env.MONGO_DB_NAME || undefined, // lets tests use an isolated database
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigins: list(process.env.CLIENT_ORIGIN || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173'),
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  geminiKey: process.env.GEMINI_API_KEY || '',
  embeddingsProvider: process.env.EMBEDDINGS_PROVIDER || 'local', // local | gemini
  proKeys: list(process.env.PRO_ACTIVATION_KEYS),
  adminEmail: (process.env.ADMIN_EMAIL || '').toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || '',
  smtpUrl: process.env.SMTP_URL || '',
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
  if (isProd && !config.proKeys.length) problems.push('PRO_ACTIVATION_KEYS must be set in production');
  if (isProd && config.clientOrigins.includes('*')) problems.push('CLIENT_ORIGIN must not be *');
  if (problems.length) {
    const msg = `Invalid configuration:\n - ${problems.join('\n - ')}`;
    if (isProd || config.isTest) throw new Error(msg);
    console.warn(`WARNING: ${msg}`);
  }
}

module.exports = { config, validate };

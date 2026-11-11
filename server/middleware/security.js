const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const { config } = require('../config/env');

const json429 = (message) => (_req, res) => res.status(429).json({ error: message });
const off = () => config.isTest && process.env.TEST_RATE_LIMITS !== 'on';

// Global: generous. Auth endpoints: strict (credential stuffing). Expensive endpoints: AI / uploads.
const limiter = (windowMs, max, message) =>
  rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false, handler: json429(message), skip: off });

const baseGlobal = limiter(60 * 1000, 300, 'Too many requests. Slow down and try again shortly.');
// Calendar apps poll the feed from shared provider servers (Google, Microsoft): thousands of users can share one IP, so the
// feed has its own, much higher ceiling and is excluded from the per-IP global limit. Tokens are 192-bit, so guessing is not a concern.
const FEED = /^\/api\/calendar\/feed\//;
const globalLimiter = (req, res, next) => (FEED.test(req.path) ? next() : baseGlobal(req, res, next));
const feedLimiter = limiter(60 * 1000, 3000, 'Calendar feed is being requested too often.');
const authLimiter = limiter(15 * 60 * 1000, 30, 'Too many sign-in attempts. Try again in a few minutes.');
const heavyLimiter = limiter(60 * 1000, 20, 'Too many requests to this feature. Wait a minute.');

function applySecurity(app) {
  app.disable('x-powered-by');
  app.set('trust proxy', config.isProd ? 1 : false); // set to your proxy hop count when deployed
  app.use(
    helmet({
      // This server returns JSON; a locked-down CSP is safe and blocks any accidental HTML rendering
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: config.isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
    })
  );
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || config.clientOrigins.includes(origin)), // non-browser clients have no Origin
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    })
  );
  app.use(globalLimiter);
}

module.exports = { applySecurity, authLimiter, heavyLimiter, feedLimiter };

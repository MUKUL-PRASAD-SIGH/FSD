const crypto = require('crypto');
const compression = require('compression');
const { config } = require('../config/env');

// Per-request correlation id (honours a sane upstream X-Request-Id), echoed back so users can quote it in bug reports.
function requestId(req, res, next) {
  const incoming = String(req.headers['x-request-id'] || '');
  req.id = /^[\w-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

// One structured JSON line per request in production (easy to ship to any log pipeline); quiet in tests.
function accessLog(req, res, next) {
  if (config.isTest || process.env.ACCESS_LOG === 'off') return next();
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    if (req.originalUrl === '/api/health' || req.originalUrl === '/api/health/ready') return; // probes are noise
    const line = { t: new Date().toISOString(), id: req.id, method: req.method, path: req.originalUrl.split('?')[0], status: res.statusCode, ms: Math.round(ms), uid: req.user ? String(req.user._id) : undefined };
    console.log(config.isProd ? JSON.stringify(line) : `${line.method} ${line.path} ${line.status} ${line.ms}ms`);
  });
  next();
}

// Anything personalised (profile, resume, recommendations, notifications, auth) must never be stored by a shared cache or the
// browser history cache. Public listing data keeps normal caching semantics.
const PRIVATE = /^\/api\/(me|auth|ask|assistant|plan|lister|admin)(\/|$)/;
function privateNoStore(req, res, next) {
  if (PRIVATE.test(req.originalUrl.split('?')[0])) {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.vary('Authorization');
  }
  next();
}

const compress = compression({ threshold: 1024 });

module.exports = { requestId, accessLog, privateNoStore, compress };

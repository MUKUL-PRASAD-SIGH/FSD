const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { config } = require('../config/env');

// Tokens carry the user's tokenVersion; bumping it (password change, "sign out everywhere", disable) revokes them.
const sign = (user) =>
  jwt.sign({ id: user._id, tv: user.tokenVersion }, config.jwtSecret, { expiresIn: config.jwtExpiresIn, algorithm: 'HS256' });

async function load(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try {
    const { id, tv } = jwt.verify(h.slice(7), config.jwtSecret, { algorithms: ['HS256'] });
    const user = await User.findById(id);
    if (!user || user.status !== 'active' || user.tokenVersion !== tv) return null;
    return user;
  } catch {
    return null;
  }
}

const protect = async (req, res, next) => {
  const user = await load(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  req.user = user;
  next();
};
const optionalAuth = async (req, _res, next) => {
  req.user = await load(req);
  next();
};

// Authorisation is always checked on the server; the UI only hides things for convenience.
const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : res.status(403).json({ error: 'You do not have permission to do that' });

const requirePro = (req, res, next) =>
  req.user?.isPro()
    ? next()
    : res.status(402).json({ error: 'This is a Pro feature. Activate Pro on the Plan page.', code: 'PRO_REQUIRED' });

const requireApprovedLister = (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  if (req.user?.role !== 'lister') return res.status(403).json({ error: 'Lister account required' });
  if (req.user.lister?.approvalStatus !== 'approved') {
    return res.status(403).json({ error: 'Your lister account is awaiting admin approval', code: 'LISTER_NOT_APPROVED' });
  }
  next();
};

module.exports = { sign, protect, optionalAuth, requireRole, requirePro, requireApprovedLister };

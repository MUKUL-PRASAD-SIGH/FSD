const jwt = require('jsonwebtoken');
const User = require('../models/User');

const secret = () => process.env.JWT_SECRET || 'dev-only-secret-change-me';
const sign = (id) => jwt.sign({ id }, secret(), { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

async function load(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try {
    const { id } = jwt.verify(h.slice(7), secret());
    return await User.findById(id);
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

module.exports = { sign, protect, optionalAuth };

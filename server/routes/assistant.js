const router = require('express').Router();
const User = require('../models/User');
const { protect, requirePro } = require('../middleware/auth');
const { heavyLimiter } = require('../middleware/security');
const { asyncRoute } = require('../utils/http');
const rag = require('../services/rag');
const { shape } = require('./listings');

// Pro-only. Every request is authenticated, plan-checked and rate limited.
router.post('/chat', protect, requirePro, heavyLimiter, asyncRoute(async (req, res) => {
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  if (question.length < 3 || question.length > 500) return res.status(400).json({ error: 'Ask a question between 3 and 500 characters' });
  const history = (Array.isArray(req.body?.history) ? req.body.history : [])
    .slice(-6).filter((h) => h && ['user', 'assistant'].includes(h.role) && typeof h.text === 'string').map((h) => ({ role: h.role, text: h.text.slice(0, 500) }));
  const user = await User.findById(req.user._id).select('+resume.text +resume.chunks');
  const out = await rag.answer(user, question, history);
  res.json(out);
}));

router.post('/reindex', protect, requirePro, heavyLimiter, asyncRoute(async (_req, res) => {
  res.json({ indexedListings: await rag.indexListings() });
}));

module.exports = router;

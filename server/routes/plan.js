const crypto = require('crypto');
const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/security');
const { asyncRoute } = require('../utils/http');
const { audit } = require('../services/audit');
const { publicUser } = require('../utils/serialize');
const { config } = require('../config/env');

const FEATURES = {
  free: ['Browse and filter live listings', 'Save and track applications', 'Calendar (.ics) deadline reminders', 'In-app notifications for matching listings', 'Basic picks from your skills and interests', 'Plain-English search', 'Connect with people: requests, accept, block', 'Live direct messages', 'Join a team or private room you are invited to', 'Live notifications and email reminders', 'Register click saves to your tracker'],
  pro: ['Everything in Free', 'Resume upload and parsing', 'RAG personalisation (resume chunks + listings embedded in MongoDB)', 'Location-aware ranking (your city, state, travel willingness)', '8-point recommendation rubric with explanations', 'AI assistant with cited answers', 'Higher-quality notifications (rubric-scored)', 'Create hackathon teams with a private team room, invite by connection or email', 'Tracker “team up”: share a hackathon with a teammate', 'Invite-only private chat rooms', 'Teammate recommendations (complementary skills, shared hackathons)', 'Open-team recommendations and join requests', 'Plain-English people search and public teams', 'Team idea board with ranked voting'],
};

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
// Constant-time comparison against every configured key (no early exit, no length leak)
const keyIsValid = (candidate) => config.proKeys.reduce((ok, k) => crypto.timingSafeEqual(sha(candidate), sha(k)) || ok, false);

router.use(protect);

router.get('/', (req, res) => res.json({ tier: req.user.plan?.tier || 'free', since: req.user.plan?.since, features: FEATURES }));

router.post('/activate', authLimiter, asyncRoute(async (req, res) => {
  const key = typeof req.body?.key === 'string' ? req.body.key.trim().slice(0, 200) : '';
  if (!key || !keyIsValid(key)) {
    audit(req, 'plan.activate_failed', { target: req.user._id });
    return res.status(403).json({ error: 'That activation key is not valid' });
  }
  req.user.plan = { tier: 'pro', since: new Date(), via: 'key' };
  await req.user.save();
  audit(req, 'plan.activate', { target: req.user._id });
  res.json({ user: publicUser(req.user) });
}));

router.post('/downgrade', asyncRoute(async (req, res) => {
  req.user.plan = { tier: 'free', since: new Date(), via: null };
  await req.user.save();
  audit(req, 'plan.downgrade', { target: req.user._id });
  res.json({ user: publicUser(req.user) });
}));

module.exports = router;

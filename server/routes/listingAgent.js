const router = require('express').Router();
const Listing = require('../models/Listing');
const UserQuery = require('../models/UserQuery');
const { protect } = require('../middleware/auth');
const { heavyLimiter } = require('../middleware/security');
const { asyncRoute } = require('../utils/http');
const agent = require('../services/pageAgent');
const community = require('../services/communityQuestions');

const loadListing = (id) => Listing.findById(id).lean().catch(() => null);
const published = (l) => l && l.status === 'published';

// POST /api/listings/:id/ask  { question, history? }
// Signed-in only (it triggers an outbound crawl), rate limited. Answers come from this event's own site + record only.
// The exchange is saved to the user's PRIVATE history; the bare question is added to the anonymous community tally only if
// the user has not opted out and it contains nothing personal.
router.post('/:id/ask', protect, heavyLimiter, asyncRoute(async (req, res) => {
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  if (question.length < 3 || question.length > 400) return res.status(400).json({ error: 'Ask a question between 3 and 400 characters' });
  const listing = await loadListing(req.params.id);
  if (!published(listing)) return res.status(404).json({ error: 'Listing not found' });
  const history = (Array.isArray(req.body?.history) ? req.body.history : [])
    .slice(-4).filter((h) => h && ['user', 'assistant'].includes(h.role) && typeof h.text === 'string').map((h) => ({ role: h.role, text: h.text.slice(0, 400) }));

  const out = await agent.ask(listing, question, history);
  await UserQuery.create({ user: req.user._id, listing: listing._id, question, answer: out.answer.slice(0, 1500) }).catch(() => {});
  const shared = req.user.privacy?.shareQuestions !== false ? await community.record(listing._id, question) : false;
  res.json({ ...out, sharedAnonymously: shared });
}));

// Your own past questions about this event (private to you).
router.get('/:id/ask/history', protect, asyncRoute(async (req, res) => {
  const rows = await UserQuery.find({ user: req.user._id, listing: req.params.id }).sort({ createdAt: -1 }).limit(20).lean().catch(() => []);
  res.json({ items: rows.reverse().map((r) => ({ question: r.question, answer: r.answer, at: r.createdAt })) });
}));
router.delete('/:id/ask/history', protect, asyncRoute(async (req, res) => {
  await UserQuery.deleteMany({ user: req.user._id, listing: req.params.id });
  res.json({ ok: true });
}));

// What people commonly ask about this event: anonymous aggregate, only questions asked 2+ times.
router.get('/:id/questions', protect, asyncRoute(async (req, res) => {
  const listing = await loadListing(req.params.id);
  if (!published(listing)) return res.status(404).json({ error: 'Listing not found' });
  res.json({ popular: await community.popular(listing._id) });
}));

module.exports = router;

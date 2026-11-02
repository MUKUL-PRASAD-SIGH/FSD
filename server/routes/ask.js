const router = require('express').Router();
const Listing = require('../models/Listing');
const User = require('../models/User');
const { optionalAuth } = require('../middleware/auth');
const { asyncRoute } = require('../utils/http');
const { parseAsk } = require('../services/askParser');
const { recommend } = require('../services/recommender');
const { shape } = require('./listings');

// "Ask": describe yourself / what you want in plain English. Rule-based parsing + the same
// ranking engine as /api/me/recommendations. Signed-in users are also ranked against their profile.
router.post('/', optionalAuth, asyncRoute(async (req, res) => {
  const question = String(req.body?.question || '').trim();
  if (question.length < 3) return res.status(400).json({ error: 'Ask a question of at least a few words' });
  const parsed = parseAsk(question);
  const listings = await Listing.find(parsed.filter).lean();

  // Treat the question itself as a temporary profile, blended with the real profile when signed in
  const base = req.user ? await User.findById(req.user._id).select('+resume.text') : null;
  const pseudo = {
    skills: [...new Set([...(parsed.skills || []), ...(base?.skills || [])])],
    interests: base?.interests || [],
    bio: `${question} ${question} ${base?.bio || ''}`,
    resume: base?.resume,
    preferences: base?.preferences || {},
    college: base?.college,
  };
  const ranked = recommend(pseudo, listings, { limit: 12 });
  res.json({
    understood: parsed.applied,
    personalised: !!req.user,
    total: listings.length,
    results: ranked.map((r) => ({ ...r, listing: shape(r.listing) })),
  });
}));

module.exports = router;

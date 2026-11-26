// Product analytics intake. Write-only: nothing here returns stored analytics (reading is admin-only, routes/admin.js).
//
// POST /api/track            { type, path?, listingId?, query? }   signed in or not
// POST /api/track/heartbeat  { seconds }                            signed in; the client sends it every ~30 s while the tab is visible
//
// Privacy: events from signed-out visitors, and from users who set privacy.shareUsage = false, are stored WITHOUT a user,
// so they only count in totals. Heartbeats (time on platform) are skipped entirely for opted-out users.
const router = require('express').Router();
const mongoose = require('mongoose');
const Activity = require('../models/Activity');
const UsageDay = require('../models/UsageDay');
const { optionalAuth, protect } = require('../middleware/auth');
const { trackLimiter } = require('../middleware/security');
const { asyncRoute } = require('../utils/http');
const { str } = require('../utils/sanitize');

const shares = (user) => !!user && user.privacy?.shareUsage !== false;
const cleanPath = (p) => str(p, 120).split(/[?#]/)[0].replace(/[^\w\-/.:~]/g, '').slice(0, 120);

router.post('/', trackLimiter, optionalAuth, asyncRoute(async (req, res) => {
  const b = req.body || {};
  if (!Activity.TYPES.includes(b.type)) return res.status(400).json({ error: 'Unknown event type' });
  const doc = { type: b.type, user: shares(req.user) ? req.user._id : null, path: cleanPath(b.path) };
  if (b.type === 'listing_view' || b.type === 'register_click') {
    if (!mongoose.isValidObjectId(b.listingId)) return res.status(400).json({ error: 'listingId is required' });
    doc.listing = b.listingId;
  }
  if (b.type === 'search') {
    doc.query = str(b.query, 80).toLowerCase().replace(/\s+/g, ' ');
    if (doc.query.length < 2) return res.status(204).end();
  }
  await Activity.create(doc);
  res.status(204).end();
}));

router.post('/heartbeat', trackLimiter, protect, asyncRoute(async (req, res) => {
  if (!shares(req.user)) return res.status(204).end();
  const seconds = Math.round(Number(req.body?.seconds));
  if (!Number.isFinite(seconds) || seconds < 1) return res.status(400).json({ error: 'seconds must be a positive number' });
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  await UsageDay.updateOne(
    { user: req.user._id, day },
    { $inc: { seconds: Math.min(seconds, 60), heartbeats: 1 }, $set: { lastSeenAt: now }, $setOnInsert: { date: new Date(`${day}T00:00:00.000Z`) } },
    { upsert: true }
  );
  res.status(204).end();
}));

module.exports = router;

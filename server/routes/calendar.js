const crypto = require('crypto');
const router = require('express').Router();
const User = require('../models/User');
const Saved = require('../models/Saved');
const Listing = require('../models/Listing');
const { protect } = require('../middleware/auth');
const { asyncRoute } = require('../utils/http');
const { feedLimiter } = require('../middleware/security');
const { audit } = require('../services/audit');
const { recommend } = require('../services/recommender');
const cal = require('../services/calendar');
const { config } = require('../config/env');

const TOKEN_RE = /^[a-f0-9]{48}$/;
const MAX_PICKS = 10;
const apiBase = () => String(config.appUrl).replace(/\/$/, '');
const feedUrl = (token) => `${apiBase()}/api/calendar/feed/${token}.ics`;
const webcal = (url) => url.replace(/^https?:/, 'webcal:');
const publiclyReachable = () => !/^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(apiBase());

// Everything that goes into one user's calendar: their tracker, plus (opt-in) their strongest picks.
async function personalEvents(user, now = new Date()) {
  const reminders = cal.cleanReminders(user.calendar?.reminders);
  const rows = await Saved.find({ user: user._id, status: { $ne: 'rejected' } }).populate('listing').lean();
  const events = [];
  const trackedIds = new Set();
  let tracked = 0;
  for (const r of rows) {
    if (!r.listing || r.listing.status !== 'published') continue;
    trackedIds.add(String(r.listing._id));
    const ev = cal.eventsFor(r.listing, { reminders, status: r.status, now });
    if (ev.length) { tracked += 1; events.push(...ev); }
  }
  let picks = 0;
  if (user.calendar?.includePicks) {
    const pool = await Listing.find({ status: 'published', deadline: { $gte: now } }).lean();
    const minMatch = user.notify?.minMatch ?? 55;
    const { results } = recommend(user, pool, { limit: 40, excludeIds: trackedIds, tier: user.isPro?.() ? 'pro' : 'free', withMeta: true });
    for (const r of results.filter((x) => x.score >= minMatch).slice(0, MAX_PICKS)) {
      const ev = cal.eventsFor(r.listing, { reminders: reminders.slice(0, 1), pick: r.score, now });
      if (ev.length) { picks += 1; events.push(...ev); }
    }
  }
  return { events, tracked, picks, reminders };
}

const sendIcs = (res, body, filename, { cache = 'private, no-store' } = {}) => {
  res.set({ 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `inline; filename="${filename}"`, 'Cache-Control': cache });
  res.send(body);
};

// ---- Public: the live, per-user subscription feed. Authenticated only by the secret token in the URL.
router.get('/feed/:token.ics', feedLimiter, asyncRoute(async (req, res) => {
  const token = req.params.token;
  if (!TOKEN_RE.test(token)) return res.status(404).json({ error: 'Not found' });
  const user = await User.findOne({ 'calendar.token': token, status: 'active' }).select('+calendar.token');
  if (!user) return res.status(404).json({ error: 'Not found' });
  const { events } = await personalEvents(user);
  const body = cal.buildCalendar({ name: `HackElite · ${user.name.split(' ')[0]}`, description: 'Your tracked hackathons and deadlines from HackElite', events, refreshMinutes: 60 });
  // calendar apps poll: allow a short private cache, never a shared one
  sendIcs(res, body, 'hackelite.ics', { cache: 'private, max-age=900' });
}));

// ---- Public: one-click "Add to Google / Outlook" links for a listing
router.get('/links/:id', asyncRoute(async (req, res) => {
  const l = await Listing.findById(req.params.id).lean().catch(() => null);
  if (!l || l.status !== 'published') return res.status(404).json({ error: 'Listing not found' });
  res.json(cal.links(l));
}));

// ---- Signed in: settings, token lifecycle, personalised single-event download
router.get('/settings', protect, asyncRoute(async (req, res) => {
  const u = await User.findById(req.user._id).select('+calendar.token');
  const token = u.calendar?.token;
  const preview = await personalEvents(u);
  res.json({
    enabled: !!token,
    feedUrl: token ? feedUrl(token) : null,
    webcalUrl: token ? webcal(feedUrl(token)) : null,
    reachableByGoogle: publiclyReachable(),
    reminders: cal.cleanReminders(u.calendar?.reminders),
    includePicks: !!u.calendar?.includePicks,
    allowedReminders: cal.ALLOWED_REMINDERS,
    counts: { tracked: preview.tracked, picks: preview.picks },
  });
}));

router.put('/settings', protect, asyncRoute(async (req, res) => {
  const u = await User.findById(req.user._id);
  if (Array.isArray(req.body?.reminders)) {
    const wanted = req.body.reminders.map(Number);
    if (wanted.some((m) => !cal.ALLOWED_REMINDERS.includes(m))) return res.status(400).json({ error: 'Unsupported reminder time' });
    u.calendar.reminders = cal.cleanReminders(wanted);
  }
  if (typeof req.body?.includePicks === 'boolean') u.calendar.includePicks = req.body.includePicks;
  await u.save();
  res.json({ ok: true, reminders: cal.cleanReminders(u.calendar.reminders), includePicks: !!u.calendar.includePicks });
}));

// Create or rotate. Rotating invalidates the old URL immediately (use it if the link was ever shared).
router.post('/token', protect, asyncRoute(async (req, res) => {
  const u = await User.findById(req.user._id);
  const rotated = !!(await User.exists({ _id: u._id, 'calendar.token': { $exists: true, $ne: null } }));
  u.calendar.token = crypto.randomBytes(24).toString('hex');
  u.calendar.tokenCreatedAt = new Date();
  await u.save();
  audit(req, rotated ? 'calendar.token_rotated' : 'calendar.token_created', { target: u._id });
  res.status(201).json({ feedUrl: feedUrl(u.calendar.token), webcalUrl: webcal(feedUrl(u.calendar.token)), reachableByGoogle: publiclyReachable() });
}));

router.delete('/token', protect, asyncRoute(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $unset: { 'calendar.token': 1, 'calendar.tokenCreatedAt': 1 } });
  audit(req, 'calendar.token_revoked', { target: req.user._id });
  res.json({ ok: true });
}));

// .ics for ONE listing with this user's reminders and tracker status (the browser fetches it with the session token)
router.get('/event/:id.ics', protect, asyncRoute(async (req, res) => {
  const l = await Listing.findById(req.params.id).lean().catch(() => null);
  if (!l || l.status !== 'published') return res.status(404).json({ error: 'Listing not found' });
  const u = await User.findById(req.user._id);
  const row = await Saved.findOne({ user: u._id, listing: l._id }).lean();
  const events = cal.eventsFor(l, { reminders: cal.cleanReminders(u.calendar?.reminders), status: row?.status });
  if (!events.length) return res.status(410).json({ error: 'This event has already closed' });
  sendIcs(res, cal.buildCalendar({ name: l.title, events }), `${String(l.title).replace(/[^\w]+/g, '-').slice(0, 40) || 'event'}.ics`);
}));

module.exports = router;
module.exports.personalEvents = personalEvents;

const router = require('express').Router();
const Listing = require('../models/Listing');
const Saved = require('../models/Saved');
const { optionalAuth } = require('../middleware/auth');
const { asyncRoute } = require('../utils/http');

const clean = (v) => (typeof v === 'string' ? v.trim() : '');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function buildFilter(q) {
  const f = { status: 'published', deadline: { $gte: new Date() } };
  if (clean(q.type)) f.type = clean(q.type).toUpperCase();
  if (clean(q.mode)) f.mode = clean(q.mode).toUpperCase();
  if (clean(q.platform)) f.platform = new RegExp(`^${esc(clean(q.platform))}$`, 'i');
  if (clean(q.city)) f.city = new RegExp(esc(clean(q.city)), 'i');
  if (q.free === 'true') f.fee = /free/i;
  if (clean(q.q)) {
    const re = new RegExp(esc(clean(q.q)), 'i');
    f.$or = [{ title: re }, { organiser: re }, { tags: re }];
  }
  if (q.closing === 'week') f.deadline = { $gte: new Date(), $lte: new Date(Date.now() + 7 * 86400000) };
  if (Number(q.minPrize) > 0) f.prizeInr = { $gte: Number(q.minPrize) };
  return f;
}

const shape = (l) => ({
  id: l._id,
  title: l.title,
  organiser: l.organiser,
  description: l.description,
  type: l.type,
  platform: l.platform,
  url: l.url,
  deadline: l.deadline,
  deadlineKind: l.deadlineKind || 'registration',
  startDate: l.startDate || null,
  endDate: l.endDate || null,
  mode: l.mode,
  city: l.city,
  state: l.state || '',
  country: l.country || '',
  prize: { label: l.prizeLabel, inr: l.prizeInr, amount: l.prizeAmount ?? null, currency: l.prizeCurrency ?? null },
  teamMin: l.teamMin ?? null,
  teamMax: l.teamMax ?? null,
  source: l.source,
  alsoOn: (l.alsoOn || []).map((a) => ({ platform: a.platform, url: a.url })),
  fee: l.fee,
  eligibility: l.eligibility,
  tags: l.tags,
  skills: l.skills,
  registered: l.registered,
});

// Public JSON API, no key required
router.get('/', asyncRoute(async (req, res) => {
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const offset = Math.min(10000, Math.max(0, parseInt(req.query.offset, 10) || 0));
  const sort = req.query.sort === 'prize' ? { prizeInr: -1, deadline: 1 } : req.query.sort === 'popular' ? { registered: -1 } : { deadline: 1 };
  const filter = buildFilter(req.query);
  const [rows, total] = await Promise.all([
    Listing.find(filter).sort(sort).skip(offset).limit(limit).lean(),
    Listing.countDocuments(filter),
  ]);
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ total, count: rows.length, offset, limit, listings: rows.map(shape) });
}));

router.get('/stats', asyncRoute(async (_req, res) => {
  const now = new Date();
  const [open, closingWeek, prize, platforms, types] = await Promise.all([
    Listing.countDocuments({ status: 'published', deadline: { $gte: now } }),
    Listing.countDocuments({ status: 'published', deadline: { $gte: now, $lte: new Date(now.getTime() + 7 * 86400000) } }),
    Listing.aggregate([{ $match: { status: 'published', deadline: { $gte: now }, prizeInr: { $ne: null } } }, { $group: { _id: null, total: { $sum: '$prizeInr' } } }]),
    Listing.aggregate([{ $match: { status: 'published', deadline: { $gte: now } } }, { $group: { _id: '$platform', n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
    Listing.aggregate([{ $match: { status: 'published', deadline: { $gte: now } } }, { $group: { _id: '$type', n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
  ]);
  const last = await Listing.findOne().sort({ refreshedAt: -1 }).select('refreshedAt').lean();
  res.json({
    open,
    closingWeek,
    prizeInr: prize[0]?.total || 0,
    platforms: platforms.map((p) => ({ name: p._id, count: p.n })),
    types: types.map((t) => ({ name: t._id, count: t.n })),
    refreshedAt: last?.refreshedAt || null,
  });
}));

// Public deadlines feed (not personalised; signed-in users get their own live feed from /api/calendar)
router.get('/calendar.ics', asyncRoute(async (req, res) => {
  const cal = require('../services/calendar');
  const ids = (req.query.ids || '').split(',').filter(Boolean);
  const filter = ids.length ? { _id: { $in: ids.filter((i) => /^[a-f0-9]{24}$/i.test(i)) }, status: 'published', deadline: { $gte: new Date() } } : buildFilter(req.query);
  const rows = await Listing.find(filter).sort({ deadline: 1 }).limit(300).lean();
  const body = cal.buildCalendar({ name: 'HackElite deadlines', description: 'Open hackathon and competition deadlines', events: rows.flatMap((l) => cal.eventsFor(l)), refreshMinutes: 120 });
  res.set({ 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="hackelite-deadlines.ics"' });
  res.send(body);
}));

router.get('/:id', optionalAuth, asyncRoute(async (req, res) => {
  const l = await Listing.findById(req.params.id).lean().catch(() => null);
  if (!l || (l.status !== 'published' && String(l.createdBy) !== String(req.user?._id) && req.user?.role !== 'admin')) {
    return res.status(404).json({ error: 'Listing not found' });
  }
  const saved = req.user ? await Saved.findOne({ user: req.user._id, listing: l._id }).lean() : null;
  res.json({ listing: shape(l), saved: saved ? { status: saved.status, note: saved.note } : null });
}));

module.exports = router;
module.exports.shape = shape;

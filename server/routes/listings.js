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

// Calendar feed: add every deadline to Google/Apple/Outlook calendars (with a day-before alarm)
router.get('/calendar.ics', asyncRoute(async (req, res) => {
  const ids = (req.query.ids || '').split(',').filter(Boolean);
  const filter = ids.length ? { _id: { $in: ids.filter((i) => /^[a-f0-9]{24}$/i.test(i)) }, status: 'published', deadline: { $gte: new Date() } } : buildFilter(req.query);
  const rows = await Listing.find(filter).sort({ deadline: 1 }).limit(300).lean();
  const fmt = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc2 = (s) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\r?\n/g, '\\n');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HackElite//Deadlines//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:HackElite deadlines'];
  for (const l of rows) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${l._id}@hackelite`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(l.deadline)}`,
      `DTEND:${fmt(new Date(new Date(l.deadline).getTime() + 3600000))}`,
      `SUMMARY:${esc2(`Deadline: ${l.title}`)}`,
      `DESCRIPTION:${esc2(`${l.organiser} on ${l.platform}. Register: ${l.url}`)}`,
      `URL:${l.url}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Deadline tomorrow', 'TRIGGER:-P1D', 'END:VALARM',
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  res.set({ 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="hackelite-deadlines.ics"' });
  res.send(lines.join('\r\n'));
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

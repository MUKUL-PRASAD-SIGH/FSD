const router = require('express').Router();
const User = require('../models/User');
const Listing = require('../models/Listing');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const { protect, requireRole } = require('../middleware/auth');
const { asyncRoute } = require('../utils/http');
const { audit } = require('../services/audit');
const { esc, str } = require('../utils/sanitize');
const { runNotifier } = require('../services/notifier');
const SourceSync = require('../models/SourceSync');

router.use(protect, requireRole('admin'));

const slim = (u) => ({
  id: u._id, name: u.name, email: u.email, role: u.role, status: u.status, plan: u.plan?.tier || 'free',
  lister: u.lister?.approvalStatus ? { organisation: u.lister.organisation, website: u.lister.website, reason: u.lister.reason, approvalStatus: u.lister.approvalStatus, reviewNote: u.lister.reviewNote } : null,
  googleLinked: !!u.googleId, createdAt: u.createdAt,
});

router.get('/stats', asyncRoute(async (_req, res) => {
  const [roles, pending, pro, bySource, open] = await Promise.all([
    User.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }]),
    User.countDocuments({ role: 'lister', 'lister.approvalStatus': 'pending' }),
    User.countDocuments({ 'plan.tier': 'pro' }),
    Listing.aggregate([{ $group: { _id: '$source', n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
    Listing.countDocuments({ status: 'published', deadline: { $gte: new Date() } }),
  ]);
  res.json({ users: Object.fromEntries(roles.map((r) => [r._id, r.n])), pendingListers: pending, proUsers: pro, listingsBySource: bySource.map((s) => ({ source: s._id, count: s.n })), openListings: open });
}));

router.get('/listers', asyncRoute(async (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  const rows = await User.find({ role: 'lister', 'lister.approvalStatus': status }).sort({ createdAt: 1 }).lean();
  res.json({ listers: rows.map(slim) });
}));

router.post('/listers/:id/decision', asyncRoute(async (req, res) => {
  const decision = req.body?.decision;
  if (!['approve', 'reject'].includes(decision)) return res.status(400).json({ error: 'decision must be "approve" or "reject"' });
  const u = await User.findById(req.params.id).catch(() => null);
  if (!u || u.role !== 'lister') return res.status(404).json({ error: 'Lister not found' });
  u.lister.approvalStatus = decision === 'approve' ? 'approved' : 'rejected';
  u.lister.reviewedBy = req.user._id;
  u.lister.reviewedAt = new Date();
  u.lister.reviewNote = str(req.body?.note, 400);
  await u.save();
  await Notification.create({
    user: u._id, type: 'lister_decision',
    title: decision === 'approve' ? 'You can now list events' : 'Your lister request was declined',
    body: u.lister.reviewNote || (decision === 'approve' ? 'Open the Lister dashboard to publish your first event.' : ''), link: '/lister',
  });
  audit(req, `lister.${decision}`, { target: u._id, meta: { note: u.lister.reviewNote } });
  res.json({ lister: slim(u) });
}));

router.get('/users', asyncRoute(async (req, res) => {
  const f = {};
  if (['user', 'lister', 'admin'].includes(req.query.role)) f.role = req.query.role;
  if (typeof req.query.q === 'string' && req.query.q.trim()) { const re = new RegExp(esc(req.query.q.trim().slice(0, 60)), 'i'); f.$or = [{ name: re }, { email: re }]; }
  const rows = await User.find(f).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ users: rows.map(slim) });
}));

router.patch('/users/:id', asyncRoute(async (req, res) => {
  const u = await User.findById(req.params.id).catch(() => null);
  if (!u) return res.status(404).json({ error: 'User not found' });
  const self = String(u._id) === String(req.user._id);
  const b = req.body || {};
  const changes = {};
  if (b.status && ['active', 'disabled'].includes(b.status)) {
    if (self) return res.status(400).json({ error: 'You cannot disable your own account' });
    u.status = b.status; changes.status = b.status;
    if (b.status === 'disabled') u.tokenVersion += 1; // kicks the user out immediately
  }
  if (b.plan && ['free', 'pro'].includes(b.plan)) { u.plan = { tier: b.plan, since: new Date(), via: b.plan === 'pro' ? 'admin' : null }; changes.plan = b.plan; }
  if (b.role && ['user', 'lister', 'admin'].includes(b.role)) {
    if (self) return res.status(400).json({ error: 'You cannot change your own role' });
    u.role = b.role; changes.role = b.role; u.tokenVersion += 1;
    if (b.role === 'lister' && !u.lister?.approvalStatus) u.lister = { organisation: u.lister?.organisation || '', approvalStatus: 'approved', reviewedBy: req.user._id, reviewedAt: new Date() };
  }
  await u.save();
  audit(req, 'admin.user_update', { target: u._id, meta: changes });
  res.json({ user: slim(u) });
}));

router.get('/listings', asyncRoute(async (req, res) => {
  const f = {};
  if (['published', 'unpublished'].includes(req.query.status)) f.status = req.query.status;
  if (req.query.source) f.source = str(req.query.source, 30);
  const rows = await Listing.find(f).sort({ createdAt: -1 }).limit(100).select('title organiser platform source status deadline createdBy createdAt').lean();
  res.json({ listings: rows });
}));

router.patch('/listings/:id', asyncRoute(async (req, res) => {
  if (!['published', 'unpublished'].includes(req.body?.status)) return res.status(400).json({ error: 'status must be published or unpublished' });
  const l = await Listing.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status } }, { new: true }).catch(() => null);
  if (!l) return res.status(404).json({ error: 'Listing not found' });
  audit(req, 'admin.listing_status', { target: l._id, meta: { status: l.status } });
  res.json({ ok: true, status: l.status });
}));

router.get('/audit', asyncRoute(async (req, res) => {
  const f = typeof req.query.action === 'string' && req.query.action ? { action: new RegExp(`^${esc(req.query.action.slice(0, 40))}`) } : {};
  const rows = await AuditLog.find(f).sort({ createdAt: -1 }).limit(100).populate('actor', 'name email role').lean();
  res.json({ events: rows.map((e) => ({ id: e._id, at: e.createdAt, action: e.action, actor: e.actor ? { name: e.actor.name, email: e.actor.email, role: e.actor.role } : null, target: e.target, meta: e.meta, ip: e.ip })) });
}));

// ---- Source coverage dashboard ----------------------------------------------------------
// Latest sync per source + the last successful sync time + live listing counts per source.
router.get('/sources', asyncRoute(async (_req, res) => {
  const { SOURCES } = require('../services/ingest/run');
  const now = new Date();
  const [latest, lastOk, live] = await Promise.all([
    SourceSync.aggregate([{ $sort: { createdAt: -1 } }, { $group: { _id: '$source', doc: { $first: '$$ROOT' } } }]),
    SourceSync.aggregate([{ $match: { status: { $in: ['ok', 'partial'] } } }, { $group: { _id: '$source', at: { $max: '$finishedAt' } } }]),
    Listing.aggregate([{ $match: { status: 'published', deadline: { $gte: now } } }, { $group: { _id: '$source', n: { $sum: 1 } } }]),
  ]);
  const L = Object.fromEntries(latest.map((x) => [x._id, x.doc]));
  const ok = Object.fromEntries(lastOk.map((x) => [x._id, x.at]));
  const n = Object.fromEntries(live.map((x) => [x._id, x.n]));
  const rows = SOURCES.map((s) => {
    const d = L[s.name];
    return {
      source: s.name, label: s.label || s.name, liveListings: n[s.name] || 0, lastSuccessAt: ok[s.name] || null,
      lastRun: d ? {
        at: d.finishedAt, status: d.status, error: d.error, skippedReason: d.skippedReason, durationMs: d.durationMs,
        raw: d.raw, valid: d.valid, expired: d.expired, duplicates: d.duplicates, rejected: d.rejected, stored: d.stored, removedStale: d.removedStale,
        rejectReasons: d.rejectReasons || {}, rejectSamples: d.rejectSamples || [], pages: d.pages || null,
      } : null,
    };
  });
  const ingested = SOURCES.reduce((sum, s) => sum + (n[s.name] || 0), 0);
  res.json({ sources: rows, manualListings: n.manual || 0, sampleListings: n.seed || 0, totalLive: ingested });
}));

router.get('/sources/:source/history', asyncRoute(async (req, res) => {
  const rows = await SourceSync.find({ source: str(req.params.source, 30) }).sort({ createdAt: -1 }).limit(30).lean();
  res.json({ runs: rows.map((d) => ({ at: d.finishedAt, status: d.status, error: d.error, raw: d.raw, valid: d.valid, expired: d.expired, duplicates: d.duplicates, rejected: d.rejected, stored: d.stored, pages: d.pages })) });
}));

// Manual sync. One at a time; the scheduled hourly run uses the same code path.
let syncing = null;
router.post('/ingest/run', asyncRoute(async (req, res) => {
  if (syncing) return res.status(409).json({ error: 'A sync is already running' });
  const { runAll } = require('../services/ingest/run');
  const only = Array.isArray(req.body?.sources) ? req.body.sources.map((x) => str(String(x), 30)).filter(Boolean) : [];
  syncing = runAll(only.length ? { only } : {});
  try {
    const r = await syncing;
    audit(req, 'admin.ingest_run', { meta: { sources: only, totals: r.totals } });
    const { afterIngest } = require('../server');
    afterIngest().catch(() => {});
    res.json({ runId: r.runId, summary: r.summary, totals: r.totals });
  } finally { syncing = null; }
}));

// Real request to each configured integration (Gemini, SMTP, Google, Kaggle, clist, MongoDB). Admin only.
router.get('/integrations', asyncRoute(async (_req, res) => {
  const { checkAll } = require('../services/integrations');
  res.json({ checks: await checkAll() });
}));

router.post('/notifier/run', asyncRoute(async (_req, res) => res.json({ created: await runNotifier() })));

// ---- Review queue: confusing listings, user reports, user-added colleges ------------------------------------------------
const ListingReport = require('../models/ListingReport');
const College = require('../models/College');
const quality = require('../services/listingQuality');
const collegeSvc = require('../services/colleges');

router.get('/review', asyncRoute(async (_req, res) => {
  const now = new Date();
  const [listings, reports, colleges] = await Promise.all([
    Listing.find({ status: 'published', deadline: { $gte: now }, 'quality.score': { $gte: 2 }, 'quality.reviewedAt': null })
      .sort({ 'quality.score': -1, deadline: 1 }).limit(50).select('title platform source url deadline quality').lean(),
    ListingReport.find({ status: 'open' }).sort({ createdAt: -1 }).limit(50).populate('listing', 'title platform url status').populate('user', 'name email').lean(),
    College.find({ source: 'user', reviewed: false }).sort({ createdAt: -1 }).limit(100).populate('addedBy', 'name email').lean(),
  ]);
  res.json({
    listings: listings.map((l) => ({ id: l._id, title: l.title, platform: l.platform, url: l.url, deadline: l.deadline, score: l.quality.score, reports: l.quality.reports || 0, issues: quality.adminNotes(l.quality.issues) })),
    reports: reports.map((r) => ({ id: r._id, reason: r.reason, note: r.note, at: r.createdAt, listing: r.listing && { id: r.listing._id, title: r.listing.title, platform: r.listing.platform, url: r.listing.url, status: r.listing.status }, by: r.user && { name: r.user.name, email: r.user.email } })),
    colleges: colleges.map((c) => ({ id: c._id, name: c.name, city: c.city, users: c.users, at: c.createdAt, by: c.addedBy && { name: c.addedBy.name, email: c.addedBy.email } })),
    counts: {
      listings: await Listing.countDocuments({ status: 'published', deadline: { $gte: now }, 'quality.score': { $gte: 2 }, 'quality.reviewedAt': null }),
      reports: await ListingReport.countDocuments({ status: 'open' }),
      colleges: await College.countDocuments({ source: 'user', reviewed: false }),
    },
  });
}));

// Leave a flagged listing as it is (stops it showing in the queue until it changes)
router.post('/review/listings/:id/ok', asyncRoute(async (req, res) => {
  const r = await Listing.updateOne({ _id: req.params.id }, { $set: { 'quality.reviewedAt': new Date() } }).catch(() => null);
  if (!r?.matchedCount) return res.status(404).json({ error: 'Listing not found' });
  audit(req, 'admin.listing_reviewed', { target: req.params.id });
  res.json({ ok: true });
}));

router.post('/review/reports/:id', asyncRoute(async (req, res) => {
  const action = req.body?.action;
  if (!['resolve', 'dismiss'].includes(action)) return res.status(400).json({ error: 'action must be resolve or dismiss' });
  const r = await ListingReport.findOneAndUpdate({ _id: req.params.id, status: 'open' }, { $set: { status: action === 'resolve' ? 'resolved' : 'dismissed', resolvedBy: req.user._id, resolvedAt: new Date() } }, { new: true }).catch(() => null);
  if (!r) return res.status(404).json({ error: 'Open report not found' });
  const open = await ListingReport.countDocuments({ listing: r.listing, status: 'open' });
  await Listing.updateOne({ _id: r.listing }, { $set: { 'quality.reports': open } });
  await quality.recheck(r.listing);
  audit(req, `admin.report_${action}`, { target: r._id, meta: { listing: String(r.listing) } });
  res.json({ ok: true });
}));

// Approve, rename, merge into another college, or hide a user-added college
router.patch('/colleges/:id', asyncRoute(async (req, res) => {
  const c = await College.findById(req.params.id).catch(() => null);
  if (!c) return res.status(404).json({ error: 'College not found' });
  const b = req.body || {};
  const prev = c.name;
  if (b.action === 'approve') { c.reviewed = true; c.hidden = false; }
  else if (b.action === 'hide') { c.reviewed = true; c.hidden = true; }
  else if (b.action === 'rename') {
    const name = collegeSvc.clean(b.name); const bad = collegeSvc.validName(name);
    if (bad) return res.status(400).json({ error: bad });
    const clash = await College.findOne({ key: collegeSvc.key(name), _id: { $ne: c._id } });
    if (clash) return res.status(409).json({ error: `“${clash.name}” already exists. Merge into it instead.` });
    c.name = name; c.key = collegeSvc.key(name); c.reviewed = true;
    await c.save(); // save the directory first, so a failure can never leave profiles pointing at a name that doesn't exist
    await User.updateMany({ college: prev }, { $set: { college: name } });
  } else if (b.action === 'merge') {
    const into = await College.findById(b.into).catch(() => null);
    if (!into || String(into._id) === String(c._id)) return res.status(400).json({ error: 'Pick the college to merge into' });
    const moved = await User.updateMany({ college: prev }, { $set: { college: into.name } });
    await College.updateOne({ _id: into._id }, { $inc: { users: moved.modifiedCount || 0 }, $addToSet: { aliases: prev, aliasKeys: c.key } });
    await c.deleteOne();
    audit(req, 'admin.college_merge', { target: into._id, meta: { from: prev, into: into.name } });
    return res.json({ ok: true, merged: into.name });
  } else return res.status(400).json({ error: 'action must be approve, rename, merge or hide' });
  await c.save();
  audit(req, `admin.college_${b.action}`, { target: c._id, meta: { from: prev, name: c.name } });
  res.json({ ok: true, college: { id: c._id, name: c.name, hidden: c.hidden } });
}));

router.get('/colleges', asyncRoute(async (req, res) => res.json({ colleges: await collegeSvc.search(req.query.q, { limit: 30 }) })));

// ---- Analytics + admin AI (admin only, like everything in this router) ------------------------------------------------
const analytics = require('../services/analytics');
const adminAssistant = require('../services/adminAssistant');
const { heavyLimiter } = require('../middleware/security');

router.get('/analytics', asyncRoute(async (req, res) => res.json(await analytics.dashboard({ days: req.query.days }))));
router.get('/analytics/breakdowns', asyncRoute(async (req, res) => {
  const [users, listings, chat] = await Promise.all([analytics.userBreakdown(), analytics.listingBreakdown({ days: req.query.days }), analytics.chatActivity({ days: req.query.days })]);
  res.json({ users, listings, chat });
}));
router.get('/analytics/users/:q', asyncRoute(async (req, res) => res.json(await analytics.userLookup({ q: req.params.q, days: req.query.days }))));

router.post('/assistant', heavyLimiter, asyncRoute(async (req, res) => {
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  if (question.length < 3 || question.length > 500) return res.status(400).json({ error: 'Ask a question between 3 and 500 characters' });
  const history = (Array.isArray(req.body?.history) ? req.body.history : [])
    .slice(-6).filter((h) => h && ['user', 'assistant'].includes(h.role) && typeof h.text === 'string').map((h) => ({ role: h.role, text: h.text.slice(0, 500) }));
  const out = await adminAssistant.answer(question, history);
  audit(req, 'admin.assistant', { meta: { question: question.slice(0, 200), tools: out.tools.map((t) => t.tool) } });
  res.json(out);
}));

module.exports = router;

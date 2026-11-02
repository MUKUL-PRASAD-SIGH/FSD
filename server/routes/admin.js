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

module.exports = router;

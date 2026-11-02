const router = require('express').Router();
const Listing = require('../models/Listing');
const { protect, requireRole, requireApprovedLister } = require('../middleware/auth');
const { asyncRoute } = require('../utils/http');
const { validateListing, TYPES, MODES, ELIGIBILITY } = require('../utils/listingInput');
const { audit } = require('../services/audit');
const { publicUser } = require('../utils/serialize');
const { notifyAdmins, readLister } = require('./auth');
const { shape } = require('./listings');

router.use(protect);

// The template the UI renders (kept on the server so the allowed values have one source of truth)
router.get('/template', (_req, res) => res.json({ types: TYPES, modes: MODES, eligibility: ELIGIBILITY }));

// An existing normal user asks to become a lister. They stay 'user' until an admin approves.
router.post('/apply', requireRole('user'), asyncRoute(async (req, res) => {
  const r = readLister(req.body || {});
  if (r.error) return res.status(400).json({ error: r.error });
  req.user.role = 'lister';
  req.user.lister = r.lister;
  await req.user.save();
  await notifyAdmins(req.user);
  audit(req, 'lister.apply', { target: req.user._id });
  res.status(201).json({ user: publicUser(req.user) });
}));

router.get('/listings', requireRole('lister', 'admin'), asyncRoute(async (req, res) => {
  const rows = await Listing.find({ createdBy: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json({ listings: rows.map((l) => ({ ...shape(l), status: l.status })) });
}));

router.post('/listings', requireApprovedLister, asyncRoute(async (req, res) => {
  const { errors, data } = validateListing(req.body || {});
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Please fix the highlighted fields', fields: errors });
  const listing = await Listing.create({
    ...data, source: 'manual', platform: 'HackElite', createdBy: req.user._id, status: 'published',
    organiser: data.organiser || req.user.lister?.organisation || req.user.name,
  });
  audit(req, 'listing.create', { target: listing._id, meta: { title: listing.title } });
  // Fire-and-forget: tell matching users right away (never blocks or fails the request)
  require('../services/notifier').runNotifier().catch((e) => console.error('notifier failed', e.message));
  res.status(201).json({ listing: { ...shape(listing), status: listing.status } });
}));

async function ownListing(req, res) {
  const l = await Listing.findById(req.params.id).catch(() => null);
  if (!l || l.source !== 'manual') { res.status(404).json({ error: 'Listing not found' }); return null; }
  if (String(l.createdBy) !== String(req.user._id) && req.user.role !== 'admin') { res.status(403).json({ error: 'You can only change your own listings' }); return null; }
  return l;
}

router.put('/listings/:id', requireApprovedLister, asyncRoute(async (req, res) => {
  const l = await ownListing(req, res);
  if (!l) return;
  const { errors, data } = validateListing(req.body || {});
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Please fix the highlighted fields', fields: errors });
  Object.assign(l, data, { embedding: undefined, embeddingModel: undefined }); // re-embed on next index
  await l.save();
  audit(req, 'listing.update', { target: l._id });
  res.json({ listing: { ...shape(l), status: l.status } });
}));

router.delete('/listings/:id', requireApprovedLister, asyncRoute(async (req, res) => {
  const l = await ownListing(req, res);
  if (!l) return;
  await l.deleteOne();
  audit(req, 'listing.delete', { target: l._id });
  res.json({ ok: true });
}));

module.exports = router;

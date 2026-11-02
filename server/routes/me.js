const router = require('express').Router();
const multer = require('multer');
const User = require('../models/User');
const Listing = require('../models/Listing');
const Saved = require('../models/Saved');
const { protect } = require('../middleware/auth');
const { asyncRoute } = require('../utils/http');
const { parseResume } = require('../services/resumeParser');
const { recommend } = require('../services/recommender');
const { parseAsk } = require('../services/askParser');
const { publicUser } = require('./auth');
const { shape } = require('./listings');

// Resumes are parsed in memory and never written to disk; only extracted fields are stored.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const uniq = (arr) => [...new Set((arr || []).map((s) => String(s).trim()).filter(Boolean))].slice(0, 40);

router.use(protect);

router.put('/profile', asyncRoute(async (req, res) => {
  const b = req.body || {};
  const u = req.user;
  for (const k of ['name', 'college', 'bio', 'githubUrl', 'linkedinUrl']) if (typeof b[k] === 'string') u[k] = b[k].trim();
  if (Array.isArray(b.skills)) u.skills = uniq(b.skills);
  if (Array.isArray(b.interests)) u.interests = uniq(b.interests);
  if (b.preferences && typeof b.preferences === 'object') {
    const p = b.preferences;
    if (Array.isArray(p.modes)) u.preferences.modes = uniq(p.modes).map((m) => m.toUpperCase());
    if (Array.isArray(p.cities)) u.preferences.cities = uniq(p.cities);
    if (Array.isArray(p.types)) u.preferences.types = uniq(p.types).map((m) => m.toUpperCase());
    if (typeof p.freeOnly === 'boolean') u.preferences.freeOnly = p.freeOnly;
    if (p.minPrizeInr != null) u.preferences.minPrizeInr = Math.max(0, Number(p.minPrizeInr) || 0);
  }
  await u.save();
  res.json({ user: publicUser(u) });
}));

router.post('/resume', upload.single('resume'), asyncRoute(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Attach a resume file in the "resume" field' });
  const { text, parsed } = await parseResume(req.file.buffer, req.file.originalname);
  const u = await User.findById(req.user._id).select('+resume.text');
  u.resume = {
    fileName: req.file.originalname,
    parsedAt: new Date(),
    text: text.slice(0, 20000),
    skills: parsed.skills,
    domains: parsed.domains,
    education: parsed.education,
    graduationYear: parsed.graduationYear,
    experienceKeywords: parsed.experienceKeywords,
    links: parsed.links,
  };
  // Merge detected skills into the editable profile; keep anything the user already had
  u.skills = uniq([...u.skills, ...parsed.skills]);
  // Suggest interests from the strongest resume domains if the user has none yet
  if (!u.interests.length) u.interests = parsed.domains.filter((d) => d.score >= 0.15).slice(0, 3).map((d) => d.name);
  if (!u.college && parsed.education[0]) u.college = parsed.education[0].slice(0, 80);
  const gh = parsed.links.find((l) => /github\.com/i.test(l));
  const li = parsed.links.find((l) => /linkedin\.com/i.test(l));
  if (gh && !u.githubUrl) u.githubUrl = /^https?:/i.test(gh) ? gh : `https://${gh}`;
  if (li && !u.linkedinUrl) u.linkedinUrl = /^https?:/i.test(li) ? li : `https://${li}`;
  await u.save();
  res.json({ user: publicUser(u), parsed: { skillDetail: parsed.skillDetail, wordCount: parsed.wordCount } });
}));

router.delete('/resume', asyncRoute(async (req, res) => {
  req.user.resume = undefined;
  await req.user.save();
  res.json({ user: publicUser(req.user) });
}));

// Personalised feed
router.get('/recommendations', asyncRoute(async (req, res) => {
  const u = await User.findById(req.user._id).select('+resume.text');
  const hasSignal = (u.skills?.length || 0) + (u.interests?.length || 0) + (u.resume?.skills?.length || 0) > 0;
  const [listings, saved] = await Promise.all([
    Listing.find({ deadline: { $gte: new Date() } }).lean(),
    Saved.find({ user: u._id }).select('listing').lean(),
  ]);
  const excludeIds = new Set(saved.map((s) => String(s.listing)));
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
  const recs = recommend(u, listings, { limit, excludeIds });
  res.json({
    hasSignal,
    basedOn: { skills: u.skills.slice(0, 12), interests: u.interests, resume: !!u.resume?.parsedAt },
    recommendations: recs.map((r) => ({ ...r, listing: shape(r.listing) })),
  });
}));

// Saved / tracker
router.get('/saved', asyncRoute(async (req, res) => {
  const rows = await Saved.find({ user: req.user._id }).populate('listing').sort({ updatedAt: -1 }).lean();
  res.json({ saved: rows.filter((r) => r.listing).map((r) => ({ id: r._id, status: r.status, note: r.note, listing: shape(r.listing) })) });
}));
router.put('/saved/:listingId', asyncRoute(async (req, res) => {
  const { status, note } = req.body || {};
  const set = {};
  if (status) set.status = status;
  if (typeof note === 'string') set.note = note.slice(0, 500);
  const row = await Saved.findOneAndUpdate(
    { user: req.user._id, listing: req.params.listingId },
    { $set: set, $setOnInsert: { user: req.user._id, listing: req.params.listingId } },
    { upsert: true, new: true, runValidators: true }
  );
  res.json({ saved: { status: row.status, note: row.note } });
}));
router.delete('/saved/:listingId', asyncRoute(async (req, res) => {
  await Saved.deleteOne({ user: req.user._id, listing: req.params.listingId });
  res.json({ ok: true });
}));

module.exports = router;

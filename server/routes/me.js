const router = require('express').Router();
const multer = require('multer');
const User = require('../models/User');
const Listing = require('../models/Listing');
const Saved = require('../models/Saved');
const Notification = require('../models/Notification');
const { protect, requirePro } = require('../middleware/auth');
const { heavyLimiter } = require('../middleware/security');
const { asyncRoute } = require('../utils/http');
const { parseResume } = require('../services/resumeParser');
const { recommend } = require('../services/recommender');
const rag = require('../services/rag');
const { publicUser } = require('../utils/serialize');
const { str, isUrl } = require('../utils/sanitize');
const { shape } = require('./listings');
const { audit } = require('../services/audit');

// Resumes are parsed in memory and never written to disk; only extracted fields are stored.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const uniq = (arr, max = 40) => [...new Set((Array.isArray(arr) ? arr : []).map((s) => str(String(s), 60)).filter(Boolean))].slice(0, max);
const oneOf = (arr, allowed) => uniq(arr).map((s) => s.toUpperCase()).filter((s) => allowed.includes(s));

// Magic-byte check so a renamed .exe can't be uploaded as a resume
function sniffOk(buf, name) {
  const ext = (name.match(/\.[a-z0-9]+$/i) || [''])[0].toLowerCase();
  if (ext === '.pdf') return buf.slice(0, 5).toString() === '%PDF-';
  if (ext === '.docx') return buf[0] === 0x50 && buf[1] === 0x4b; // zip container
  if (ext === '.txt' || ext === '.md') return !buf.slice(0, 2000).includes(0);
  return false;
}

router.use(protect);

router.put('/profile', asyncRoute(async (req, res) => {
  const b = req.body || {};
  const u = req.user;
  for (const [k, max] of [['name', 80], ['college', 160], ['bio', 600]]) if (typeof b[k] === 'string' && b[k].trim()) u[k] = str(b[k], max);
  if (typeof b.bio === 'string') u.bio = str(b.bio, 600);
  for (const k of ['githubUrl', 'linkedinUrl']) if (typeof b[k] === 'string') u[k] = b[k] && isUrl(b[k]) ? b[k].slice(0, 300) : '';
  if (Array.isArray(b.skills)) u.skills = uniq(b.skills);
  if (Array.isArray(b.interests)) u.interests = uniq(b.interests, 12);
  if (b.location && typeof b.location === 'object') {
    u.location.city = str(b.location.city, 80); u.location.state = str(b.location.state, 80); u.location.country = str(b.location.country, 80) || 'India';
  }
  if (b.education && typeof b.education === 'object') {
    if (['', 'school', 'undergraduate', 'postgraduate', 'phd', 'working'].includes(b.education.level)) u.education.level = b.education.level;
    const y = Number(b.education.gradYear);
    u.education.gradYear = y >= 1990 && y <= 2040 ? y : undefined;
  }
  if (b.preferences && typeof b.preferences === 'object') {
    const p = b.preferences;
    u.preferences.modes = oneOf(p.modes, ['ONLINE', 'OFFLINE', 'HYBRID']);
    u.preferences.types = oneOf(p.types, ['HACKATHON', 'CASE STUDY', 'CONTEST', 'CODING', 'INNOVATION', 'DESIGN', 'COMPETITION', 'QUIZ']);
    u.preferences.cities = uniq(p.cities, 10);
    if (typeof p.freeOnly === 'boolean') u.preferences.freeOnly = p.freeOnly;
    if (typeof p.willingToTravel === 'boolean') u.preferences.willingToTravel = p.willingToTravel;
    if (p.minPrizeInr != null) u.preferences.minPrizeInr = Math.min(1e8, Math.max(0, Number(p.minPrizeInr) || 0));
  }
  if (b.notify && typeof b.notify === 'object') {
    if (typeof b.notify.inApp === 'boolean') u.notify.inApp = b.notify.inApp;
    if (typeof b.notify.email === 'boolean') u.notify.email = b.notify.email;
    if (b.notify.minMatch != null) u.notify.minMatch = Math.min(100, Math.max(0, Number(b.notify.minMatch) || 0));
  }
  // role, plan, lister.approvalStatus and tokenVersion are deliberately NOT assignable here
  await u.save();
  res.json({ user: publicUser(u) });
}));

// ---- Resume parsing + indexing: Pro only -------------------------------------------------
router.post('/resume', requirePro, heavyLimiter, upload.single('resume'), asyncRoute(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Attach a resume file in the "resume" field' });
  if (!sniffOk(req.file.buffer, req.file.originalname)) return res.status(400).json({ error: 'That file does not look like a valid PDF, DOCX or TXT' });
  const { text, parsed } = await parseResume(req.file.buffer, req.file.originalname);
  const u = await User.findById(req.user._id);
  u.resume = {
    fileName: str(req.file.originalname.replace(/[^\w.\- ]/g, '_'), 120),
    parsedAt: new Date(), text: text.slice(0, 20000),
    skills: parsed.skills, domains: parsed.domains, education: parsed.education,
    graduationYear: parsed.graduationYear, experienceKeywords: parsed.experienceKeywords, links: parsed.links,
  };
  await rag.indexResume(u, text.slice(0, 20000)); // RAG: chunk + embed into MongoDB
  u.skills = uniq([...u.skills, ...parsed.skills]);
  if (!u.interests.length) u.interests = parsed.domains.filter((d) => d.score >= 0.15).slice(0, 3).map((d) => d.name);
  if (!u.college && parsed.education[0]) u.college = parsed.education[0].slice(0, 80);
  if (!u.education.gradYear && parsed.graduationYear) u.education.gradYear = parsed.graduationYear;
  const gh = parsed.links.find((l) => /github\.com/i.test(l));
  const li = parsed.links.find((l) => /linkedin\.com/i.test(l));
  if (gh && !u.githubUrl) u.githubUrl = /^https?:/i.test(gh) ? gh : `https://${gh}`;
  if (li && !u.linkedinUrl) u.linkedinUrl = /^https?:/i.test(li) ? li : `https://${li}`;
  await u.save();
  audit(req, 'resume.upload', { target: u._id });
  res.json({ user: publicUser(u), parsed: { skillDetail: parsed.skillDetail, wordCount: parsed.wordCount } });
}));

router.delete('/resume', asyncRoute(async (req, res) => {
  req.user.resume = undefined;
  await req.user.save();
  res.json({ user: publicUser(req.user) });
}));

// ---- Recommendations: free = basic picks, pro = resume + location rubric + semantic ------
router.get('/recommendations', asyncRoute(async (req, res) => {
  const saved = await Saved.find({ user: req.user._id }).select('listing').lean();
  const excludeIds = new Set(saved.map((s) => String(s.listing)));
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);

  if (req.user.isPro()) {
    const { user, results, excluded } = await rag.proRecommendations(req.user._id, { limit, excludeIds });
    return res.json({
      tier: 'pro',
      hasSignal: (user.skills?.length || 0) + (user.interests?.length || 0) + (user.resume?.skills?.length || 0) > 0,
      basedOn: { skills: user.skills.slice(0, 12), interests: user.interests, resume: !!user.resume?.parsedAt, location: user.location?.city || user.location?.state || null, education: user.education?.level || null },
      excluded,
      recommendations: results.map((r) => ({ ...r, listing: shape(r.listing) })),
    });
  }
  const u = req.user;
  const listings = await Listing.find({ status: 'published', deadline: { $gte: new Date() } }).lean();
  const { results: recs, excluded } = recommend(u, listings, { limit, excludeIds, tier: 'free', withMeta: true });
  res.json({
    tier: 'free',
    hasSignal: (u.skills?.length || 0) + (u.interests?.length || 0) > 0,
    basedOn: { skills: u.skills.slice(0, 12), interests: u.interests, resume: false, location: null, education: u.education?.level || null },
    excluded,
    upgrade: 'Pro adds resume parsing, location-aware ranking, an 8-point rubric and the AI assistant.',
    recommendations: recs.map((r) => ({ ...r, listing: shape(r.listing) })),
  });
}));

// ---- Saved / tracker -----------------------------------------------------------------------
const STATUSES = ['saved', 'applied', 'shortlisted', 'rejected', 'won'];
router.get('/saved', asyncRoute(async (req, res) => {
  const rows = await Saved.find({ user: req.user._id }).populate('listing').sort({ updatedAt: -1 }).lean();
  res.json({ saved: rows.filter((r) => r.listing).map((r) => ({ id: r._id, status: r.status, note: r.note, listing: shape(r.listing) })) });
}));
router.put('/saved/:listingId', asyncRoute(async (req, res) => {
  const set = {};
  if (STATUSES.includes(req.body?.status)) set.status = req.body.status;
  if (typeof req.body?.note === 'string') set.note = req.body.note.slice(0, 500);
  if (!(await Listing.exists({ _id: req.params.listingId, status: 'published' }).catch(() => null))) return res.status(404).json({ error: 'Listing not found' });
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

// ---- Notifications ----------------------------------------------------------------------
router.get('/notifications', asyncRoute(async (req, res) => {
  const [items, unread] = await Promise.all([
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50).lean(),
    Notification.countDocuments({ user: req.user._id, readAt: null }),
  ]);
  res.json({ unread, notifications: items.map((n) => ({ id: n._id, type: n.type, title: n.title, body: n.body, link: n.link, score: n.score, listing: n.listing, read: !!n.readAt, createdAt: n.createdAt })) });
}));
router.post('/notifications/read-all', asyncRoute(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  res.json({ ok: true });
}));
router.post('/notifications/:id/read', asyncRoute(async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { $set: { readAt: new Date() } }).catch(() => {});
  res.json({ ok: true });
}));

module.exports = router;

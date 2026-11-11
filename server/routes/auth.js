const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const router = require('express').Router();
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sign, protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/security');
const { asyncRoute } = require('../utils/http');
const { publicUser } = require('../utils/serialize');
const { checkPassword, MIN_LENGTH } = require('../utils/password');
const { str, isEmail, isUrl } = require('../utils/sanitize');
const { audit } = require('../services/audit');
const { sendMail } = require('../services/mailer');
const google = require('../services/google');
const { isBreached } = require('../utils/breached');
const { config } = require('../config/env');

const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
// Compared against when the email is unknown so response time doesn't reveal which emails exist
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

const bad = (res, msg, status = 400, extra = {}) => res.status(status).json({ error: msg, ...extra });
const session = (user) => ({ token: sign(user), user: publicUser(user) });

// Lister details are required for lister sign-ups; returns { error } or { lister }
function readLister(b) {
  const organisation = str(b.organisation, 120);
  const website = str(b.website, 300);
  const reason = str(b.reason, 600);
  if (organisation.length < 2) return { error: 'Tell us the organisation or community you list for' };
  if (website && !isUrl(website)) return { error: 'Website must be a valid http(s) link' };
  return { lister: { organisation, website, reason, approvalStatus: 'pending' } };
}

async function notifyAdmins(user) {
  const admins = await User.find({ role: 'admin', status: 'active' }).select('_id').lean();
  await Notification.insertMany(
    admins.map((a) => ({
      user: a._id, type: 'lister_request', title: 'New lister awaiting approval',
      body: `${user.name} (${user.lister?.organisation || 'no organisation'}) asked to list events.`, link: '/admin',
    })),
    { ordered: false }
  ).catch(() => {});
}

router.get('/config', (_req, res) =>
  res.json({ googleClientId: config.googleClientId || null, passwordMinLength: MIN_LENGTH, emailEnabled: !!config.smtpUrl })
);

router.post('/password-check', authLimiter, (req, res) => {
  const { password, email, name } = req.body || {};
  res.json(checkPassword(password));
});

router.post('/register', authLimiter, asyncRoute(async (req, res) => {
  const b = req.body || {};
  const name = str(b.name, 80);
  const email = str(b.email, 254).toLowerCase();
  if (name.length < 2) return bad(res, 'Enter your full name');
  if (!isEmail(email)) return bad(res, 'Enter a valid email address');
  const pw = checkPassword(b.password);
  if (!pw.ok) return bad(res, 'Password is too weak', 400, { problems: pw.problems });
  if (await isBreached(b.password)) return bad(res, 'This password has appeared in a known data breach. Choose a different one.', 400, { problems: ['Appears in a known data breach'] });

  // Only these two roles can ever be self-selected. "admin" can never be requested through the API.
  const accountType = b.accountType === 'lister' ? 'lister' : 'user';
  let lister;
  if (accountType === 'lister') {
    const r = readLister(b);
    if (r.error) return bad(res, r.error);
    lister = r.lister;
  }
  if (await User.exists({ email })) return bad(res, 'An account with this email already exists', 409);

  const user = await User.create({ name, email, password: b.password, role: accountType, lister });
  if (accountType === 'lister') await notifyAdmins(user);
  sendVerification(user).catch((e) => console.error('mail failed', e.message));
  audit(req, 'auth.register', { actor: user, target: user._id, meta: { role: accountType } });
  res.status(201).json(session(user));
}));

router.post('/login', authLimiter, asyncRoute(async (req, res) => {
  const email = str(req.body?.email, 254).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password.slice(0, 128) : '';
  const user = email ? await User.findOne({ email }).select('+password') : null;

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    return bad(res, 'Invalid email or password', 401);
  }
  if (user.isLocked()) {
    const mins = Math.ceil((user.lockUntil - Date.now()) / 60000);
    return bad(res, `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`, 423);
  }
  if (user.status !== 'active') return bad(res, 'This account has been disabled', 403);
  if (!user.password) return bad(res, 'This account uses Google sign-in. Use "Continue with Google".', 401, { code: 'USE_GOOGLE' });

  if (!(await user.comparePassword(password))) {
    user.failedLogins += 1;
    if (user.failedLogins >= MAX_FAILS) { user.lockUntil = new Date(Date.now() + LOCK_MS); user.failedLogins = 0; audit(req, 'auth.lockout', { actor: user, target: user._id }); }
    await user.save();
    return bad(res, 'Invalid email or password', 401);
  }
  if (user.failedLogins || user.lockUntil) { user.failedLogins = 0; user.lockUntil = undefined; await user.save(); }
  audit(req, 'auth.login', { actor: user, target: user._id });
  res.json(session(user));
}));

// Google: the browser gets an ID token from Google; we verify it server-side and never trust the client's claims.
router.post('/google', authLimiter, asyncRoute(async (req, res) => {
  const credential = typeof req.body?.credential === 'string' ? req.body.credential : '';
  if (!credential) return bad(res, 'Missing Google credential');
  const g = await google.verifyGoogleToken(credential);

  let user = await User.findOne({ googleId: g.googleId });
  if (!user) {
    user = await User.findOne({ email: g.email });
    if (user) {
      // Safe to link: Google has verified this email belongs to the same person
      user.googleId = g.googleId;
      user.emailVerified = true;
      if (!user.avatar) user.avatar = g.avatar;
      await user.save();
      audit(req, 'auth.google_link', { actor: user, target: user._id });
    } else {
      const accountType = req.body?.accountType === 'lister' ? 'lister' : 'user';
      let lister;
      if (accountType === 'lister') {
        const r = readLister(req.body);
        if (r.error) return bad(res, r.error, 400, { code: 'LISTER_DETAILS_REQUIRED' });
        lister = r.lister;
      }
      user = await User.create({ name: g.name.slice(0, 80), email: g.email, googleId: g.googleId, avatar: g.avatar, emailVerified: true, role: accountType, lister });
      if (accountType === 'lister') await notifyAdmins(user);
      audit(req, 'auth.register', { actor: user, target: user._id, meta: { via: 'google', role: accountType } });
    }
  }
  if (user.status !== 'active') return bad(res, 'This account has been disabled', 403);
  audit(req, 'auth.login', { actor: user, target: user._id, meta: { via: 'google' } });
  res.json({ ...session(user), isNew: user.createdAt && Date.now() - user.createdAt.getTime() < 5000 });
}));

router.get('/me', protect, (req, res) => res.json({ user: publicUser(req.user) }));

router.post('/change-password', protect, authLimiter, asyncRoute(async (req, res) => {
  const { current, password } = req.body || {};
  const user = await User.findById(req.user._id).select('+password');
  // Google-only accounts may set a first password without a current one
  if (user.password && !(await user.comparePassword(String(current || '')))) return bad(res, 'Current password is incorrect', 401);
  const pw = checkPassword(password);
  if (!pw.ok) return bad(res, 'Password is too weak', 400, { problems: pw.problems });
  if (await isBreached(password)) return bad(res, 'This password has appeared in a known data breach. Choose a different one.', 400, { problems: ['Appears in a known data breach'] });
  user.password = password; // pre-save hook hashes it and bumps tokenVersion (revokes other sessions)
  await user.save();
  audit(req, 'auth.password_change', { actor: user, target: user._id });
  res.json(session(user));
}));

// Right to erasure: removes the account, resume data, saved items and notifications. Re-auth required.
router.delete('/me', protect, authLimiter, asyncRoute(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (user.password && !(await user.comparePassword(String(req.body?.password || '')))) return bad(res, 'Password is incorrect', 401);
  if (user.role === 'admin' && (await User.countDocuments({ role: 'admin', status: 'active' })) <= 1) return bad(res, 'You are the last admin and cannot delete this account', 400);
  const Saved = require('../models/Saved');
  const Listing = require('../models/Listing');
  await Promise.all([
    Saved.deleteMany({ user: user._id }),
    Notification.deleteMany({ user: user._id }),
    require('../models/UserQuery').deleteMany({ user: user._id }),
    Listing.updateMany({ createdBy: user._id }, { $set: { status: 'unpublished' } }), // keep records, take them offline
  ]);
  audit(req, 'auth.delete_account', { actor: user, target: user._id });
  await user.deleteOne();
  res.json({ ok: true });
}));

router.post('/logout-all', protect, asyncRoute(async (req, res) => {
  req.user.tokenVersion += 1;
  await req.user.save();
  audit(req, 'auth.logout_all', { actor: req.user, target: req.user._id });
  res.json({ ok: true });
}));

// Always answers the same way so it can't be used to discover registered emails
router.post('/forgot', authLimiter, asyncRoute(async (req, res) => {
  const email = str(req.body?.email, 254).toLowerCase();
  const user = isEmail(email) ? await User.findOne({ email, status: 'active' }) : null;
  if (user) {
    const raw = crypto.randomBytes(32).toString('hex');
    user.resetTokenHash = crypto.createHash('sha256').update(raw).digest('hex');
    user.resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save({ validateBeforeSave: false });
    await sendMail({ to: user.email, subject: 'Reset your HackElite password', text: `Reset your password (valid 30 minutes):\n${config.appUrl}/reset?token=${raw}\n\nIf you did not ask for this, ignore this email.` }).catch((e) => console.error('mail failed', e.message));
    audit(req, 'auth.forgot', { actor: user, target: user._id });
  }
  res.json({ ok: true, message: 'If that email has an account, a reset link is on its way.' });
}));

router.post('/reset', authLimiter, asyncRoute(async (req, res) => {
  const { token, password } = req.body || {};
  const hash = crypto.createHash('sha256').update(String(token || '')).digest('hex');
  const user = await User.findOne({ resetTokenHash: hash, resetTokenExpires: { $gt: new Date() } }).select('+resetTokenHash +resetTokenExpires +password');
  if (!user) return bad(res, 'This reset link is invalid or has expired', 400);
  const pw = checkPassword(password);
  if (!pw.ok) return bad(res, 'Password is too weak', 400, { problems: pw.problems });
  if (await isBreached(password)) return bad(res, 'This password has appeared in a known data breach. Choose a different one.', 400, { problems: ['Appears in a known data breach'] });
  user.password = password;
  user.resetTokenHash = undefined; user.resetTokenExpires = undefined;
  user.failedLogins = 0; user.lockUntil = undefined;
  await user.save();
  audit(req, 'auth.password_reset', { actor: user, target: user._id });
  res.json(session(user));
}));

// ---- Email verification: single-use hashed token, 24 h. Soft requirement: unverified users can sign in, the UI nudges them. ----
async function sendVerification(user) {
  if (user.emailVerified) return;
  const raw = crypto.randomBytes(32).toString('hex');
  user.verifyTokenHash = crypto.createHash('sha256').update(raw).digest('hex');
  user.verifyTokenExpires = new Date(Date.now() + 24 * 3600 * 1000);
  await user.save();
  await sendMail({ to: user.email, subject: 'Verify your HackElite email', text: `Confirm your email address (valid 24 hours):
${config.appUrl}/verify?token=${raw}

If you did not create an account, ignore this email.` });
}
router.post('/verify/send', protect, authLimiter, asyncRoute(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (user.emailVerified) return res.json({ ok: true, alreadyVerified: true });
  await sendVerification(user);
  res.json({ ok: true, message: 'Verification email sent. Check your inbox.' });
}));
router.post('/verify', authLimiter, asyncRoute(async (req, res) => {
  const raw = typeof req.body?.token === 'string' ? req.body.token : '';
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const user = await User.findOne({ verifyTokenHash: hash, verifyTokenExpires: { $gt: new Date() } }).select('+verifyTokenHash +verifyTokenExpires');
  if (!user) return bad(res, 'This verification link is invalid or has expired', 400);
  user.emailVerified = true; user.verifyTokenHash = undefined; user.verifyTokenExpires = undefined;
  await user.save();
  audit(req, 'auth.email_verified', { actor: user, target: user._id });
  res.json({ ok: true });
}));

module.exports = router;
module.exports.notifyAdmins = notifyAdmins;
module.exports.readLister = readLister;

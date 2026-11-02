const router = require('express').Router();
const User = require('../models/User');
const { sign, protect } = require('../middleware/auth');

const publicUser = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  college: u.college,
  bio: u.bio,
  githubUrl: u.githubUrl,
  linkedinUrl: u.linkedinUrl,
  skills: u.skills,
  interests: u.interests,
  preferences: u.preferences,
  resume: u.resume
    ? {
        fileName: u.resume.fileName,
        parsedAt: u.resume.parsedAt,
        skills: u.resume.skills,
        domains: u.resume.domains,
        education: u.resume.education,
        graduationYear: u.resume.graduationYear,
        experienceKeywords: u.resume.experienceKeywords,
        links: u.resume.links,
      }
    : null,
});

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (await User.findOne({ email: email.toLowerCase() })) return res.status(409).json({ error: 'An account with this email already exists' });
  const user = await User.create({ name, email, password });
  res.status(201).json({ token: sign(user._id), user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = await User.findOne({ email: (email || '').toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password || ''))) return res.status(401).json({ error: 'Invalid email or password' });
  res.json({ token: sign(user._id), user: publicUser(user) });
});

router.get('/me', protect, (req, res) => res.json({ user: publicUser(req.user) }));

module.exports = router;
module.exports.publicUser = publicUser;

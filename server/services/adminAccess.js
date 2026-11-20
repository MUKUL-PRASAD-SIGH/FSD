// Admin by email (ADMIN_EMAILS / ADMIN_EMAIL). Promotion needs a VERIFIED email: either the user clicked the verification
// link (proving they own the inbox) or signed in with Google (Google verified it). Registering someone else's address
// gives nothing, because unverified accounts are never promoted.
const { config } = require('../config/env');
const { audit } = require('./audit');

const isAdminEmail = (email) => !!email && config.adminEmails.includes(String(email).toLowerCase());

// Mutates and saves `user` when it should become an admin. Returns true if it was promoted.
async function promoteIfAdminEmail(user, req) {
  if (!user || user.role === 'admin' || user.status !== 'active' || !user.emailVerified || !isAdminEmail(user.email)) return false;
  const from = user.role;
  user.role = 'admin';
  await user.save();
  audit(req, 'auth.admin_promoted', { actor: user, target: user._id, meta: { from, via: 'ADMIN_EMAILS' } });
  console.log(`Promoted ${user.email} to admin (listed in ADMIN_EMAILS)`);
  return true;
}

// At start-up: promote existing verified accounts on the list (e.g. after ADMIN_EMAILS was changed)
async function promoteExisting() {
  if (!config.adminEmails.length) return 0;
  const User = require('../models/User');
  const users = await User.find({ email: { $in: config.adminEmails }, emailVerified: true, status: 'active', role: { $ne: 'admin' } });
  for (const u of users) await promoteIfAdminEmail(u);
  return users.length;
}

module.exports = { isAdminEmail, promoteIfAdminEmail, promoteExisting };

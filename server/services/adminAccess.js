// Admin by email (ADMIN_EMAILS / ADMIN_EMAIL), safe against account pre-hijacking.
//
// The threat: someone registers an admin address with a password THEY chose, before the real owner does. Later the owner
// clicks the verification email or signs in with Google, the account becomes "verified", and without care it would be
// promoted while the attacker's password still works.
//
// The rule: an account is promoted only when every way into it is controlled by the inbox owner:
//   - via Google sign-in (Google proves the inbox): any password that was not set through the emailed reset link is
//     REMOVED and all sessions are revoked, then the account is promoted;
//   - via password sign-in, email verification or start-up: only if the password was set through the emailed reset link
//     (passwordProvenAt) or the account has no password. Otherwise nothing happens; the owner can use "Forgot password"
//     (or Google) to prove control, which promotes them.
const { config } = require('../config/env');
const { audit } = require('./audit');

const isAdminEmail = (email) => !!email && config.adminEmails.includes(String(email).toLowerCase());
const unprovenPassword = (u) => !!u.hasPassword && !u.passwordProvenAt;

// Mutates and saves `user`. via: 'google' | 'password' | 'verify' | 'reset' | 'startup'. Returns true if promoted.
async function promoteIfAdminEmail(user, req, { via = 'password' } = {}) {
  if (!user || user.role === 'admin' || user.status !== 'active' || !user.emailVerified || !isAdminEmail(user.email)) return false;
  if (unprovenPassword(user)) {
    if (via !== 'google') {
      audit(req, 'auth.admin_promotion_held', { actor: user, target: user._id, meta: { via, reason: 'password not set via the emailed reset link' } });
      return false;
    }
    // Google proved the inbox, but someone else may know this password: remove it and end every other session
    user.password = undefined; user.hasPassword = false; user.passwordProvenAt = undefined;
    user.tokenVersion += 1;
    audit(req, 'auth.admin_password_cleared', { actor: user, target: user._id });
  }
  const from = user.role;
  user.role = 'admin';
  await user.save();
  audit(req, 'auth.admin_promoted', { actor: user, target: user._id, meta: { from, via } });
  console.log(`Promoted ${user.email} to admin (ADMIN_EMAILS, via ${via})`);
  return true;
}

// At start-up: promote listed accounts that already satisfy the rule (e.g. after ADMIN_EMAILS changed)
async function promoteExisting() {
  if (!config.adminEmails.length) return 0;
  const User = require('../models/User');
  const users = await User.find({ email: { $in: config.adminEmails }, emailVerified: true, status: 'active', role: { $ne: 'admin' } });
  let n = 0;
  for (const u of users) if (await promoteIfAdminEmail(u, null, { via: 'startup' })) n++;
  return n;
}

module.exports = { isAdminEmail, promoteIfAdminEmail, promoteExisting, unprovenPassword };

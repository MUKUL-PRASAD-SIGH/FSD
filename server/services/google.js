// Verifies a Google Identity Services ID token (the "credential" the browser button returns).
// Checks signature, expiry, issuer and audience (must equal GOOGLE_CLIENT_ID) via google-auth-library.
const { config } = require('../config/env');

let client;
async function verifyGoogleToken(idToken) {
  if (!config.googleClientId) {
    const err = new Error('Google sign-in is not configured on this server (GOOGLE_CLIENT_ID missing).');
    err.status = 501;
    throw err;
  }
  const { OAuth2Client } = require('google-auth-library');
  client = client || new OAuth2Client(config.googleClientId);
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: config.googleClientId });
    const p = ticket.getPayload();
    if (!p?.email || !p.email_verified) throw new Error('Google account email is not verified');
    return { googleId: p.sub, email: p.email.toLowerCase(), name: p.name || p.email.split('@')[0], avatar: p.picture || '' };
  } catch (e) {
    const err = new Error('Google sign-in failed: invalid or expired token');
    err.status = 401;
    throw err;
  }
}

module.exports = { verifyGoogleToken, _setVerifier: (fn) => { module.exports.verifyGoogleToken = fn; } };

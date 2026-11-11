// Breached-password check using the Pwned Passwords range API (k-anonymity): only the first 5 hex chars of the SHA-1
// leave the server, never the password. Fails OPEN (returns false) on timeout/network error so sign-up never breaks
// because a third party is down. Disabled in tests and with HIBP_CHECK=off.
const crypto = require('crypto');

async function isBreached(password, { fetchImpl = fetch, timeoutMs = 2500 } = {}) {
  if (process.env.NODE_ENV === 'test' && !process.env.HIBP_FORCE) return false;
  if (process.env.HIBP_CHECK === 'off') return false;
  const sha = crypto.createHash('sha1').update(String(password)).digest('hex').toUpperCase();
  const prefix = sha.slice(0, 5); const suffix = sha.slice(5);
  try {
    const res = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, { headers: { 'Add-Padding': 'true' }, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return false;
    const body = await res.text();
    return body.split('\n').some((l) => { const [h, n] = l.trim().split(':'); return h === suffix && Number(n) > 0; });
  } catch { return false; }
}

module.exports = { isBreached };

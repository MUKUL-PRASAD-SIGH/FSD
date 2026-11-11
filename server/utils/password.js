// Password policy shared by the API (enforced) and documented for the UI (which mirrors it for feedback).
const MIN_LENGTH = 10;

// Returns { ok, score (0-4), problems: [] }
function checkPassword(pw) {
  const problems = [];
  const p = String(pw || '');
  if (p.length < MIN_LENGTH) problems.push(`Use at least ${MIN_LENGTH} characters`);
  if (p.length > 128) problems.push('Use at most 128 characters');
  if (!/[a-z]/.test(p)) problems.push('Add a lowercase letter');
  if (!/[A-Z]/.test(p)) problems.push('Add an uppercase letter');
  if (!/\d/.test(p)) problems.push('Add a number');
  if (!/[^A-Za-z0-9]/.test(p)) problems.push('Add a symbol (e.g. ! @ # $)');
  let score = 0;
  if (p.length >= MIN_LENGTH) score++;
  if (p.length >= 14) score++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  if (problems.length) score = Math.min(score, 2);
  return { ok: problems.length === 0, score, problems };
}

module.exports = { checkPassword, MIN_LENGTH };

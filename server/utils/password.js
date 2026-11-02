// Password policy shared by the API (enforced) and documented for the UI (which mirrors it for feedback).
const COMMON = new Set([
  'password', 'password1', 'password123', 'passw0rd', 'qwerty', 'qwerty123', 'qwertyuiop', '12345678', '123456789', '1234567890',
  'iloveyou', 'admin123', 'welcome1', 'welcome123', 'letmein', 'abc12345', 'abcd1234', 'monkey123', 'dragon123', 'football1',
  'changeme', 'hackelite', 'hackelite123', 'student123', 'india123', 'test1234', 'testtest',
]);

const COMMON_BASES = ['password', 'passw', 'qwerty', 'welcome', 'letmein', 'iloveyou', 'admin', 'administrator', 'hackelite', 'student', 'football', 'dragon', 'monkey', 'changeme', 'secret', 'princess', 'sunshine', 'master', 'login', 'india', 'cricket', 'abcdef'];

const MIN_LENGTH = 10;

// Returns { ok, score (0-4), problems: [] }
function checkPassword(pw, { email = '', name = '' } = {}) {
  const problems = [];
  const p = String(pw || '');
  if (p.length < MIN_LENGTH) problems.push(`Use at least ${MIN_LENGTH} characters`);
  if (p.length > 128) problems.push('Use at most 128 characters');
  if (!/[a-z]/.test(p)) problems.push('Add a lowercase letter');
  if (!/[A-Z]/.test(p)) problems.push('Add an uppercase letter');
  if (!/\d/.test(p)) problems.push('Add a number');
  if (!/[^A-Za-z0-9]/.test(p)) problems.push('Add a symbol (e.g. ! @ # $)');
  const lower = p.toLowerCase();
  // "Password123!" is still "password": strip digits/symbols, undo leetspeak, and compare the letters left over
  const leet = lower.replace(/@/g, 'a').replace(/0/g, 'o').replace(/\$/g, 's').replace(/3/g, 'e').replace(/5/g, 's');
  const letters = leet.replace(/[^a-z]/g, '');
  const commonBase = COMMON_BASES.some((b) => letters === b || (letters.startsWith(b) && letters.length - b.length <= 3) || (letters.endsWith(b) && letters.length - b.length <= 3));
  if (COMMON.has(lower) || commonBase || /^(.)\1+$/.test(p) || /(0123|1234|2345|abcd|qwer)/i.test(p)) problems.push('Avoid common words and sequences');
  const local = String(email).split('@')[0].toLowerCase();
  if (local.length >= 4 && lower.includes(local)) problems.push('Do not include your email name');
  const first = String(name).trim().split(/\s+/)[0].toLowerCase();
  if (first.length >= 4 && lower.includes(first)) problems.push('Do not include your name');

  let score = 0;
  if (p.length >= MIN_LENGTH) score++;
  if (p.length >= 14) score++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  if (problems.length) score = Math.min(score, 2);
  return { ok: problems.length === 0, score, problems };
}

module.exports = { checkPassword, MIN_LENGTH };

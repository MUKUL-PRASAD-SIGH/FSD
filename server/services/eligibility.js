// Reads a listing's eligibility text and decides whether a given user can take part.
// Returns { eligible: true | false | null, score: 0..1, note, audience: [...] }
//   true  -> the stated audience includes the user (or is open to all)
//   false -> the stated audience clearly excludes the user (education level or graduation batch) -> never recommended
//   null  -> nothing stated, or a condition we cannot check (gender, residency, invite-only) -> kept, flagged
const AUDIENCE = {
  school: /high[- ]?school|school students|\bclass\s?(?:9|10|11|12)(?:th)?\b|\bk-?12\b|secondary school|\bteen(?:ager)?s?\b|under[- ]?18/,
  undergraduate: /under[- ]?grad|bachelor|\bb\.?\s?tech\b|\bb\.?\s?e\b|\bb\.?\s?sc\b|\bbca\b|\bbba\b|\bb\.?\s?com\b|(?<!post[- ]?)graduates?\b/,
  postgraduate: /post[- ]?grad|master'?s|\bm\.?\s?tech\b|\bmba\b|\bm\.?\s?sc\b|\bmca\b|\bpgdm\b|management students/,
  phd: /ph\.?\s?d|doctoral|research scholars?/,
  working: /professionals?|working|experienced|employees|freelanc|founders?|startups?|industry/,
};
// "college/university/engineering students" covers every higher-education level
const COLLEGE = /college|university|engineering|institutes?\b|campus|higher education|tertiary/;
const OPEN = /open to all|open for all|everyone|anyone|all (?:students|participants|levels)|no (?:restriction|eligibility)|^students?$|any student/;
const UNCHECKABLE = [
  [/women|female|girls/, 'women-only'],
  [/invite[- ]only|by invitation/, 'invite only'],
  [/residents?|citizens?|nationals?|country-specific|only in /, 'residency rules'],
  [/\bage\b|years? old|18\+/, 'age limit'],
];

function audienceOf(text) {
  const t = String(text || '').toLowerCase();
  const set = new Set();
  if (OPEN.test(t)) return { open: true, set };
  for (const [k, re] of Object.entries(AUDIENCE)) if (re.test(t)) set.add(k);
  if (COLLEGE.test(t)) { set.add('undergraduate'); set.add('postgraduate'); set.add('phd'); }
  // A bare "students" means students of any level
  if (!set.size && /\bstudents?\b/.test(t)) { set.add('school'); set.add('undergraduate'); set.add('postgraduate'); set.add('phd'); }
  return { open: false, set };
}

// "2026 & 2027 batch", "graduating in 2027", "passing out 2026" -> [2026, 2027]
function batchYears(text) {
  const t = String(text || '').toLowerCase();
  if (!/batch|graduat|passing|pass[- ]?out|class of|year of/.test(t)) return [];
  return [...new Set((t.match(/\b20[2-4]\d\b/g) || []).map(Number))];
}

function eligibilityFor(listing, user) {
  const text = (listing.eligibility || []).join('; ');
  const level = user.education?.level || '';
  const gradYear = Number(user.education?.gradYear) || Number(user.resume?.graduationYear) || null;
  const lower = text.toLowerCase();
  const flags = UNCHECKABLE.filter(([re]) => re.test(lower)).map(([, n]) => n);
  if (!text.trim()) return { eligible: null, score: 0.6, note: '', audience: [] };

  const { open, set } = audienceOf(text);
  const years = batchYears(text);
  if (gradYear && years.length && !years.includes(gradYear)) {
    return { eligible: false, score: 0, note: `for the ${years.join('/')} batch; you graduate in ${gradYear}`, audience: [...set] };
  }
  const batchOk = gradYear && years.includes(gradYear);
  if (batchOk && (!set.size || !level || set.has(level))) return { eligible: flags.length ? null : true, score: flags.length ? 0.6 : 1, note: flags.length ? `check eligibility: ${flags.join(', ')}` : `open to the ${gradYear} batch`, audience: [...set] };
  if (open) return { eligible: flags.length ? null : true, score: flags.length ? 0.6 : 1, note: flags.length ? `check eligibility: ${flags.join(', ')}` : 'open to everyone', audience: ['all'] };
  if (!level) {
    // Unknown education: only hard-exclude nothing; slight preference for clearly college-level events
    return { eligible: null, score: set.size ? 0.6 : 0.5, note: flags.length ? `check eligibility: ${flags.join(', ')}` : '', audience: [...set] };
  }
  if (set.size && !set.has(level)) {
    const who = [...set].map((s) => ({ school: 'school students', undergraduate: 'undergraduates', postgraduate: 'postgraduates', phd: 'PhD students', working: 'professionals' }[s])).join(', ');
    return { eligible: false, score: 0, note: `only for ${who}`, audience: [...set] };
  }
  if (set.has(level)) return { eligible: flags.length ? null : true, score: flags.length ? 0.6 : 1, note: flags.length ? `check eligibility: ${flags.join(', ')}` : 'open to your education level', audience: [...set] };
  return { eligible: null, score: 0.5, note: flags.length ? `check eligibility: ${flags.join(', ')}` : '', audience: [] };
}

module.exports = { eligibilityFor, audienceOf, batchYears };

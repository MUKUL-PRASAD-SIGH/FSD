// Turns an adapter's raw record into a stored listing, or explains why it can't be stored.
//
// Rules (also documented in docs/reports/SOURCE_COVERAGE_REPORT.md):
//   REJECT  missing_title      no usable title
//   REJECT  invalid_url        no http(s) link a student could follow
//   REJECT  missing_date       no deadline, start date or end date at all (we cannot tell if it is still open)
//   REJECT  unparseable_date   a date was given but could not be understood
//   REJECT  implausible_date   deadline more than 2 years away (almost always a placeholder/bad data)
//   EXPIRED                    deadline already passed -> counted, not stored
// Everything else is KEPT, even with missing prize, location, skills or eligibility. Missing optional fields get
// neutral defaults and the record notes which fields were inferred (e.g. deadline taken from the event end date).
const { extractSkills } = require('../skills');
const { parseDate } = require('./parse');

const TYPES = ['HACKATHON', 'CASE STUDY', 'CONTEST', 'CODING', 'INNOVATION', 'DESIGN', 'COMPETITION', 'QUIZ'];
const MODES = ['ONLINE', 'OFFLINE', 'HYBRID'];
const MAX_AHEAD_MS = 2 * 365 * 86400000;

const { decodeEntities } = require('./parse');
const clip = (s, n) => decodeEntities(String(s ?? '')).replace(/\s+/g, ' ').trim().slice(0, n);
const list = (a, n, each = 60) => [...new Set((Array.isArray(a) ? a : []).map((x) => clip(typeof x === 'string' ? x : x?.name ?? '', each)).filter(Boolean))].slice(0, n);

function httpUrl(u) {
  try {
    const x = new URL(String(u || '').trim());
    return ['http:', 'https:'].includes(x.protocol) ? x.toString() : null;
  } catch { return null; }
}

function toDate(v, tz) {
  if (v == null || v === '') return { d: null, given: false };
  const d = v instanceof Date ? (isNaN(v) ? null : v) : parseDate(v, { tz });
  return { d, given: true };
}

// Picks the date that tells a student "act before this": the stated registration/submission deadline, otherwise
// the event start (you must be registered by then), and only then the event end. Adapters whose events can be
// joined while running (CodeChef long contests, Kaggle) pass an explicit deadline instead.
function resolveDeadline(raw) {
  const candidates = [
    ['registration', raw.deadline],
    ['event_start', raw.startDate],
    ['event_end', raw.endDate],
  ];
  let sawUnparseable = false;
  for (const [kind, v] of candidates) {
    const { d, given } = toDate(v, raw.tz);
    if (d) return { deadline: d, deadlineKind: raw.deadlineKind && kind === 'registration' ? raw.deadlineKind : kind };
    if (given) sawUnparseable = true;
  }
  return { deadline: null, error: sawUnparseable ? 'unparseable_date' : 'missing_date' };
}

function validate(raw, { now = new Date() } = {}) {
  if (!raw || typeof raw !== 'object') return { status: 'rejected', reason: 'not_an_object' };
  const title = clip(raw.title, 200);
  if (!title) return { status: 'rejected', reason: 'missing_title', raw };
  const url = httpUrl(raw.url);
  if (!url) return { status: 'rejected', reason: 'invalid_url', raw };
  const r = resolveDeadline(raw);
  if (!r.deadline) return { status: 'rejected', reason: r.error, raw };
  if (r.deadline.getTime() - now.getTime() > MAX_AHEAD_MS) return { status: 'rejected', reason: 'implausible_date', raw };
  if (r.deadline <= now) return { status: 'expired', raw };

  const startDate = toDate(raw.startDate, raw.tz).d;
  const endDate = toDate(raw.endDate, raw.tz).d;
  const type = TYPES.includes(String(raw.type).toUpperCase()) ? String(raw.type).toUpperCase() : 'COMPETITION';
  const mode = MODES.includes(String(raw.mode).toUpperCase()) ? String(raw.mode).toUpperCase() : 'ONLINE';
  const description = clip(raw.description, 1500);
  const tags = list(raw.tags, 10);
  const text = `${title} ${tags.join(' ')} ${description}`;
  const skills = [...new Set([...list(raw.skills, 12), ...extractSkills(text).map((s) => s.name)])].slice(0, 12);
  const inferred = [];
  if (r.deadlineKind !== 'registration') inferred.push(`deadline from ${r.deadlineKind.replace('_', ' ')}`);
  if (raw.mode == null) inferred.push('mode assumed online');

  const prizeInr = Number.isFinite(raw.prizeInr) && raw.prizeInr > 0 ? Math.round(raw.prizeInr) : null;
  const item = {
    externalId: clip(raw.externalId ?? url, 300),
    title,
    organiser: clip(raw.organiser, 160),
    description,
    type,
    platform: clip(raw.platform, 40) || 'Direct',
    url,
    deadline: r.deadline,
    deadlineKind: r.deadlineKind,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    mode,
    city: clip(raw.city, 80),
    state: clip(raw.state, 80),
    country: clip(raw.country, 80),
    prizeLabel: clip(raw.prizeLabel, 80) || (prizeInr ? undefined : 'See listing'),
    prizeInr,
    prizeAmount: Number.isFinite(raw.prizeAmount) && raw.prizeAmount > 0 ? raw.prizeAmount : null,
    prizeCurrency: clip(raw.prizeCurrency, 8) || null,
    fee: clip(raw.fee, 40) || 'Free',
    eligibility: list(raw.eligibility, 6, 120),
    tags,
    skills,
    registered: Number.isFinite(Number(raw.registered)) && Number(raw.registered) > 0 ? Math.round(Number(raw.registered)) : null,
    teamMin: raw.teamMin >= 1 && raw.teamMin <= 20 ? raw.teamMin : undefined,
    teamMax: raw.teamMax >= 1 && raw.teamMax <= 20 ? raw.teamMax : undefined,
    inferred,
  };
  if (!item.prizeLabel) item.prizeLabel = 'See listing';
  for (const k of Object.keys(item)) if (item[k] === undefined) delete item[k];
  return { status: 'valid', item };
}

module.exports = { validate, resolveDeadline, httpUrl, TYPES, MODES };

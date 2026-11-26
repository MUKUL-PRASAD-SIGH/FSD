// Listing quality: spot listings that could confuse people, so the UI can highlight them and an admin can fix or choose.
// Pure rules over the stored record (no network). Runs after every ingest and whenever a listing is created or edited.
const Listing = require('../models/Listing');

const DAY = 86400000;
// code -> [severity (1 minor .. 3 serious), admin note, user-facing hint or null when it is not worth showing users]
const RULES = {
  dates_inconsistent: [3, 'Start/end/deadline dates contradict each other', 'The dates on this listing look inconsistent. Check the organiser page before planning.'],
  deadline_far: [2, 'Deadline is more than a year away (probably a parsing error)', 'The deadline looks unusually far away. Confirm it on the organiser page.'],
  deadline_inferred: [2, 'Registration deadline was inferred, not published', 'The registration deadline was worked out from the event dates. Confirm it on the organiser page.'],
  offline_no_city: [2, 'In-person event without a city', 'This is an in-person event but the city is not stated.'],
  team_size_invalid: [2, 'Minimum team size is larger than the maximum', 'Team size information looks wrong.'],
  no_organiser: [1, 'Organiser missing', null],
  no_description: [1, 'Description missing or very short', null],
  prize_unclear: [1, 'Prize not stated', 'Prize details are not stated.'],
  fee_unclear: [1, 'Entry fee not stated', 'Entry fee is not stated. Check before registering.'],
  title_suspicious: [1, 'Title looks truncated or placeholder-like', null],
  reported: [3, 'Reported by users', 'People reported a problem with this listing. An admin is checking it.'],
};

function check(l, now = new Date()) {
  const issues = [];
  const d = l.deadline ? new Date(l.deadline) : null;
  const s = l.startDate ? new Date(l.startDate) : null;
  const e = l.endDate ? new Date(l.endDate) : null;
  if ((s && e && s > e) || (e && d && d > new Date(e.getTime() + DAY) && l.deadlineKind === 'registration')) issues.push('dates_inconsistent');
  if (d && d - now > 365 * DAY) issues.push('deadline_far');
  if ((l.inferred || []).some((x) => /^deadline from/.test(x))) issues.push('deadline_inferred');
  if (['OFFLINE', 'HYBRID'].includes(l.mode) && !l.city && !l.state) issues.push('offline_no_city');
  if (l.teamMin && l.teamMax && l.teamMin > l.teamMax) issues.push('team_size_invalid');
  if (!String(l.organiser || '').trim()) issues.push('no_organiser');
  if (String(l.description || '').trim().length < 40) issues.push('no_description');
  if ((l.prizeInr == null && l.prizeAmount == null) && /^(see listing|)$/i.test(String(l.prizeLabel || '').trim())) issues.push('prize_unclear');
  if (!String(l.fee || '').trim()) issues.push('fee_unclear');
  const t = String(l.title || '').trim();
  if (t.length < 6 || /^(untitled|test|tbd|tba|null|undefined)$/i.test(t) || /\.\.\.$|…$/.test(t)) issues.push('title_suspicious');
  if ((l.quality?.reports || 0) > 0) issues.push('reported');
  const score = issues.reduce((sum, c) => sum + RULES[c][0], 0);
  return { issues, score };
}

// What a user sees on the listing: only issues that change what they should do
const userHints = (l) => (l.quality?.issues || []).map((c) => RULES[c]?.[2]).filter(Boolean);
const adminNotes = (codes) => codes.map((c) => ({ code: c, severity: RULES[c]?.[0] || 1, note: RULES[c]?.[1] || c }));

// Re-check every open listing. Returns how many now need review (score >= 2).
async function scanOpen() {
  const now = new Date();
  const rows = await Listing.find({ status: 'published', deadline: { $gte: now } })
    .select('title organiser description deadline deadlineKind startDate endDate mode city state prizeLabel prizeInr prizeAmount fee teamMin teamMax inferred quality').lean();
  const ops = [];
  let flagged = 0;
  for (const l of rows) {
    const q = check(l, now);
    if (q.score >= 2) flagged++;
    const same = JSON.stringify(q.issues) === JSON.stringify(l.quality?.issues || []) && q.score === l.quality?.score;
    if (!same) ops.push({ updateOne: { filter: { _id: l._id }, update: { $set: { 'quality.issues': q.issues, 'quality.score': q.score, 'quality.checkedAt': now } } } });
  }
  for (let i = 0; i < ops.length; i += 500) await Listing.bulkWrite(ops.slice(i, i + 500), { ordered: false });
  return { checked: rows.length, flagged, changed: ops.length };
}

async function recheck(id) {
  const l = await Listing.findById(id).lean();
  if (!l) return null;
  const q = check(l);
  await Listing.updateOne({ _id: id }, { $set: { 'quality.issues': q.issues, 'quality.score': q.score, 'quality.checkedAt': new Date() } });
  return q;
}

module.exports = { check, scanOpen, recheck, userHints, adminNotes, RULES };

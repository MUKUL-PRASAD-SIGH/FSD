// Pro matching engine: who should I team up with, and which open teams fit me?
// Adapted from the reference dashboard's scorers (complementary skills beat clones; open slots and timing matter) and extended
// with what only this platform knows: the hackathons you BOTH track, your resume skills and your tracker history.
//
// Privacy rules, enforced here and tested:
//   - only people with social.discoverable === true are ever returned (opt-in, default off)
//   - nothing private is returned: no email, no notes, no tracker beyond "also tracking <a hackathon YOU track too>"
//   - blocked people (either direction) and yourself are always excluded
const User = require('../models/User');
const Team = require('../models/Team');
const Saved = require('../models/Saved');
const Listing = require('../models/Listing');
const Connection = require('../models/Connection');
const { extractSkills } = require('./skills');
const social = require('./social');

const DAY = 86400000;
const norm = (s) => String(s || '').toLowerCase().trim();
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
// A skill's canonical key groups spellings ("ML", "machine learning", "figma" -> UI/UX); unknown skills keep their own lowercase text.
const canonKey = (s) => { const t = norm(s); const e = t ? extractSkills(t)[0] : null; return e ? norm(e.name) : t; };
// key -> the wording the person used (shown in reasons)
function skillMap(u) {
  const m = new Map();
  for (const s of [...(u.skills || []), ...(u.resume?.skills || [])]) { const t = String(s).trim(); if (t.length < 2) continue; const k = canonKey(t); if (!m.has(k)) m.set(k, t); }
  return m;
}
const skillSet = (u) => new Set(skillMap(u).keys());

async function context(user) {
  const [mine, rels] = await Promise.all([
    Saved.find({ user: user._id }).select('listing status').lean(),
    Connection.find({ $or: [{ requester: user._id }, { recipient: user._id }] }).select('requester recipient status blockedBy').lean(),
  ]);
  const blocked = new Set(); const connected = new Set(); const pending = new Set();
  for (const r of rels) {
    const other = String(r.requester) === String(user._id) ? String(r.recipient) : String(r.requester);
    if (r.status === 'blocked') blocked.add(other); else if (r.status === 'accepted') connected.add(other); else if (r.status === 'pending') pending.add(other);
  }
  return { tracked: new Set(mine.map((s) => String(s.listing))), skills: skillSet(user), interests: new Set((user.interests || []).map(norm)), blocked, connected, pending };
}

// ---- teammates ---------------------------------------------------------------------------------------------------
function scoreTeammate(cand, me, { sharedTitles = [], wins = 0, connected = false } = {}) {
  const theirs = skillMap(cand);
  const reasons = []; let score = 0;
  const complementary = [...theirs].filter(([k]) => !me.skills.has(k)).map(([, d]) => d);
  const shared = [...theirs].filter(([k]) => me.skills.has(k)).map(([, d]) => d);
  if (complementary.length) { score += Math.min(complementary.length, 4) * 10; reasons.push(`Brings skills you don't list: ${complementary.slice(0, 4).join(', ')}`); }
  if (shared.length) { score += Math.min(shared.length, 2) * 5; reasons.push(`Shares your ${shared.slice(0, 2).join(', ')}`); }
  if (sharedTitles.length) { score += Math.min(sharedTitles.length, 2) * 25; reasons.push(`Also tracking ${sharedTitles.slice(0, 2).join(' and ')}`); }
  const interests = (cand.interests || []).map(norm).filter((i) => me.interests.has(i));
  if (interests.length) { score += 8; reasons.push(`Interested in ${interests.slice(0, 2).join(', ')}`); }
  if (cand.social?.lookingForTeam) { score += 10; reasons.push('Is looking for a team'); }
  if (wins > 0) { score += Math.min(wins, 3) * 5; reasons.push(`${wins} hackathon win${wins > 1 ? 's' : ''}`); }
  if (cand.githubUrl || cand.linkedinUrl) { score += 5; reasons.push('Has public work to review'); }
  if (connected) { score += 10; reasons.push('Already connected with you'); }
  return { score: Math.round(clamp(score, 0, 100)), reasons };
}

async function recommendTeammates(user, { limit = 8 } = {}) {
  const me = await context(user);
  const pool = await User.find({ 'social.discoverable': true, status: 'active', _id: { $ne: user._id } })
    .select('name avatar social skills resume.skills interests githubUrl linkedinUrl').limit(500).lean();
  const cands = pool.filter((c) => !me.blocked.has(String(c._id)));
  const ids = cands.map((c) => c._id);
  // what each candidate tracks that I track too, and their wins (one query each, not per person)
  const [theirTracked, wins] = await Promise.all([
    me.tracked.size ? Saved.find({ user: { $in: ids }, listing: { $in: [...me.tracked] } }).select('user listing').lean() : [],
    Saved.aggregate([{ $match: { user: { $in: ids }, status: 'won' } }, { $group: { _id: '$user', n: { $sum: 1 } } }]),
  ]);
  const titles = new Map((await Listing.find({ _id: { $in: [...new Set(theirTracked.map((t) => String(t.listing)))] } }).select('title').lean()).map((l) => [String(l._id), l.title]));
  const sharedBy = new Map(); for (const t of theirTracked) { const k = String(t.user); (sharedBy.get(k) || sharedBy.set(k, []).get(k)).push(titles.get(String(t.listing))); }
  const winsBy = new Map(wins.map((w) => [String(w._id), w.n]));
  return cands
    .map((c) => ({ c, m: scoreTeammate(c, me, { sharedTitles: (sharedBy.get(String(c._id)) || []).filter(Boolean), wins: winsBy.get(String(c._id)) || 0, connected: me.connected.has(String(c._id)) }) }))
    .filter((r) => r.m.score > 0)
    .sort((a, b) => b.m.score - a.m.score)
    .slice(0, limit)
    .map(({ c, m }) => ({ ...social.card(c), skills: [...skillMap(c).values()].slice(0, 8), lookingForTeam: !!c.social?.lookingForTeam, matchScore: m.score, matchReasons: m.reasons, relation: me.connected.has(String(c._id)) ? 'accepted' : me.pending.has(String(c._id)) ? 'pending' : 'none' }));
}

// ---- teams -------------------------------------------------------------------------------------------------------
function scoreTeam(team, listing, me, now = Date.now()) {
  const reasons = []; let score = 0;
  if (listing && me.tracked.has(String(listing._id))) { score += 40; reasons.push(`You're tracking ${listing.title}`); }
  const want = (team.lookingFor || []).map(norm).filter(Boolean);
  const hits = want.filter((w) => me.skills.has(canonKey(w)) || [...me.skills].some((s) => s.includes(w) || w.includes(s)));
  if (hits.length) { score += Math.min(hits.length, 3) * 10; reasons.push(`They need ${hits.slice(0, 3).join(', ')}, which you have`); }
  const open = team.maxMembers - team.members.length;
  score += clamp(open, 1, 3) * 5; reasons.push(`${open} open slot${open > 1 ? 's' : ''}`);
  if (listing?.deadline) {
    const d = (new Date(listing.deadline).getTime() - now) / DAY;
    if (d >= 7 && d <= 21) { score += 12; reasons.push('Deadline is in the ideal 1 to 3 week window'); }
    else if (d > 21 && d <= 60) score += 8; else if (d >= 2 && d < 7) { score += 5; reasons.push('Closing soon'); }
  }
  return { score: Math.round(clamp(score, 0, 100)), reasons };
}

async function recommendTeams(user, { limit = 8 } = {}) {
  const me = await context(user);
  const teams = await Team.find({ visibility: 'public', owner: { $ne: user._id }, 'members.user': { $ne: user._id }, $expr: { $lt: [{ $size: '$members' }, '$maxMembers'] } }).sort({ updatedAt: -1 }).limit(300).lean();
  const listings = new Map((await Listing.find({ _id: { $in: teams.map((t) => t.listing).filter(Boolean) } }).select('title deadline status url platform').lean()).map((l) => [String(l._id), l]));
  const now = Date.now();
  const owners = new Map((await User.find({ _id: { $in: teams.map((t) => t.owner) } }).select('name social.headline avatar').lean()).map((u) => [String(u._id), u]));
  return teams
    .filter((t) => !me.blocked.has(String(t.owner)))
    .map((t) => ({ t, l: t.listing ? listings.get(String(t.listing)) : null }))
    .filter(({ l, t }) => (t.listing ? l && l.status === 'published' && new Date(l.deadline) > now : true))
    .map(({ t, l }) => ({ t, l, m: scoreTeam(t, l, me, now) }))
    .sort((a, b) => b.m.score - a.m.score)
    .slice(0, limit)
    .map(({ t, l, m }) => ({
      id: String(t._id), name: t.name, description: t.description, lookingFor: t.lookingFor, openSlots: t.maxMembers - t.members.length, memberCount: t.members.length,
      owner: owners.get(String(t.owner)) ? social.card(owners.get(String(t.owner))) : null,
      listing: l ? { id: String(l._id), title: l.title, deadline: l.deadline, url: l.url, platform: l.platform } : null, matchScore: m.score, matchReasons: m.reasons,
    }));
}

// ---- people search -----------------------------------------------------------------------------------------------
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const EXPERIENCE = [[/\b(beginner|newbie|junior|first[- ]?time)\b/i, 'beginner'], [/\b(expert|senior|advanced|experienced)\b/i, 'expert']];

// Free: name search among discoverable people. Pro: plain English ("figma designer looking for a team").
const QUERY_STOP = new Set('looking for team teams who know knows with and the need needs open a an to join that can are is of in on people person someone anyone find show me my who\'s'.split(' '));
async function searchPeople(user, q, { pro = false, limit = 20 } = {}) {
  const text = String(q || '').trim().slice(0, 120);
  if (text.length < 2) return [];
  const me = await context(user);
  const base = { 'social.discoverable': true, status: 'active', _id: { $ne: user._id } };
  let filter = { ...base, name: new RegExp(escapeRe(text), 'i') };
  let wantKeys = []; let tokens = []; let lookingOnly = false;
  if (pro) {
    wantKeys = extractSkills(text).map((s) => norm(s.name));
    tokens = [...new Set(text.toLowerCase().replace(/[^a-z0-9+#.\s]/g, ' ').split(/\s+/).filter((t) => t.length >= 3 && !QUERY_STOP.has(t)))];
    lookingOnly = /looking for (a )?team|need(s)? a team|open to team/i.test(text);
    const skillRes = [...new Set([...tokens, ...wantKeys])].map((t) => new RegExp(escapeRe(t), 'i'));
    const or = [{ name: new RegExp(escapeRe(text), 'i') }, { 'social.headline': new RegExp(escapeRe(text), 'i') }];
    if (skillRes.length) or.push({ skills: { $in: skillRes } }, { 'resume.skills': { $in: skillRes } }, { 'social.headline': { $in: skillRes } });
    filter = { ...base, $or: or };
    if (lookingOnly) filter['social.lookingForTeam'] = true;
  }
  const rows = await User.find(filter).select('name avatar social skills resume.skills').limit(100).lean();
  const out = rows.filter((r) => !me.blocked.has(String(r._id))).map((r) => {
    const sm = skillMap(r);
    const keyHits = wantKeys.filter((k) => sm.has(k)).length;
    const tokenHits = tokens.filter((t) => [...sm.values()].some((v) => v.toLowerCase().includes(t))).length;
    return { ...social.card(r), skills: [...sm.values()].slice(0, 8), lookingForTeam: !!r.social?.lookingForTeam, relation: me.connected.has(String(r._id)) ? 'accepted' : me.pending.has(String(r._id)) ? 'pending' : 'none', _rank: keyHits * 10 + tokenHits * 6 + (r.social?.lookingForTeam ? 2 : 0) };
  });
  return out.sort((x, y) => y._rank - x._rank).slice(0, limit).map(({ _rank, ...rest }) => rest);
}

module.exports = { recommendTeammates, recommendTeams, searchPeople, scoreTeammate, scoreTeam, skillSet };

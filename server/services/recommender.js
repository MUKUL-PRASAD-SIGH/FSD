// Explainable, deterministic recommendation engine with two tiers.
//
// Both tiers first apply HARD FILTERS (never recommended, counted in `excluded`):
//   - deadline already passed
//   - clearly ineligible: the listing's stated audience excludes the user's education level or graduation batch
//   - duplicates: the same opportunity listed twice (same normalised title + close dates) keeps only its best entry
//
// FREE (basic picks): uses what the user typed (skills, interests, preferences).
//   score = 0.45 interests + 0.35 skills + 0.20 urgency
// PRO (rubric): adds the parsed resume, location, eligibility, semantic similarity, timing and value.
//   skills .22 | semantic .18 | interests .12 | location .14 | eligibility .08 | preferences .10 | timing .08 | value .08
//   then soft penalties: in person abroad (x0.5) or elsewhere when not travelling (x0.75), unverifiable eligibility (x0.9), paid when free-only (x0.6).
//
// Every criterion is in [0,1]. The result carries `breakdown` (criterion -> score), `criteria` (label, weight,
// points contributed, human-readable detail) and up to five plain-English `reasons`. Same inputs + same `now`
// always produce the same order (ties broken by deadline, then id).
const { extractSkills, domainOf } = require('./skills');
const { locationFit } = require('../utils/geo');
const { eligibilityFor } = require('./eligibility');
const { titleKey } = require('./ingest/dedupe');

const RUBRIC = { skills: 0.22, semantic: 0.18, interests: 0.12, location: 0.14, eligibility: 0.08, preferences: 0.1, timing: 0.08, value: 0.08 };
const BASIC = { interests: 0.45, skills: 0.35, urgency: 0.2 };
const W = RUBRIC; // kept for backwards compatibility
const LABELS = {
  skills: 'Skills match', semantic: 'Profile similarity', interests: 'Interests / domains', location: 'Location',
  eligibility: 'Eligibility', preferences: 'Your preferences', timing: 'Time to prepare', value: 'Prize vs. competition', urgency: 'Deadline urgency',
};

const STOP = new Set('the a an and or of to in for on with at by from is are be as this that it we you your our will can all any new more open join build team event hackathon challenge competition'.split(' '));
const tokenize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9+#.\s/]/g, ' ').split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t));

function tfidfVectors(docs) {
  const df = new Map();
  const tfs = docs.map((tokens) => {
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
    return tf;
  });
  const n = docs.length;
  return tfs.map((tf) => {
    const v = new Map();
    let norm = 0;
    for (const [t, c] of tf) {
      const w = (1 + Math.log(c)) * (Math.log((n + 1) / ((df.get(t) || 0) + 1)) + 1);
      v.set(t, w); norm += w * w;
    }
    return { v, norm: Math.sqrt(norm) || 1 };
  });
}
function cosineMap(a, b) {
  const [s, l] = a.v.size < b.v.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [t, w] of s.v) if (l.v.has(t)) dot += w * l.v.get(t);
  return dot / (a.norm * b.norm);
}

const THEME_DOMAINS = [
  [/machine learning|\bai\b|artificial|llm|deep learning|data science|kaggle/, 'AI/ML'], [/web|frontend|backend|full[- ]?stack/, 'Web Development'],
  [/blockchain|web3|crypto|defi|ethereum|solana/, 'Blockchain & Web3'], [/security|cyber|ctf/, 'Cybersecurity'], [/mobile|android|ios|flutter/, 'Mobile Development'],
  [/data|analytics/, 'Data Science'], [/design|ux|ui\b/, 'Design'], [/devops|cloud|infra|kubernetes/, 'Cloud & DevOps'],
  [/iot|hardware|robot|embedded/, 'Hardware & IoT'], [/finance|marketing|strategy|management|consult|business|product/, 'Business'],
];

function listingProfile(l) {
  const text = `${l.title} ${l.description || ''} ${(l.tags || []).join(' ')} ${(l.skills || []).join(' ')}`;
  const found = extractSkills(text);
  const skills = new Set([...(l.skills || []), ...found.map((f) => f.name)]);
  const domains = new Set(found.map((f) => f.domain));
  for (const s of l.skills || []) { const d = domainOf(s); if (d) domains.add(d); }
  const tagText = `${(l.tags || []).join(' ')} ${l.title}`.toLowerCase();
  for (const [re, d] of THEME_DOMAINS) if (re.test(tagText)) domains.add(d);
  if (l.type === 'CASE STUDY') domains.add('Business');
  if (l.type === 'CODING' || l.type === 'CONTEST') domains.add('Competitive Programming');
  return { skills, domains, text };
}

function userProfile(user) {
  const resume = user.resume || {};
  const skills = new Set([...(user.skills || []), ...(resume.skills || [])]);
  const domainWeights = new Map();
  for (const d of resume.domains || []) domainWeights.set(d.name, d.score);
  for (const i of user.interests || []) domainWeights.set(i, Math.max(domainWeights.get(i) || 0, 0.6));
  for (const s of skills) { const d = domainOf(s); if (d && !domainWeights.has(d)) domainWeights.set(d, 0.15); }
  const text = [[...skills].join(' '), (user.interests || []).join(' '), user.bio || '', resume.text || ''].join(' ');
  return { skills, domainWeights, text };
}

const daysLeft = (deadline, now) => (new Date(deadline) - now) / 86400000;

function urgencyScore(deadline, now) {
  const days = daysLeft(deadline, now);
  if (days < 0) return 0;
  if (days <= 3) return 0.85;
  if (days <= 14) return 1;
  if (days <= 45) return 0.7;
  return 0.4;
}

// Do you have enough time to build/prepare? Hackathons need days, case studies need prep, contests need almost none.
function timingFit(l, now) {
  const need = { HACKATHON: 3, 'CASE STUDY': 5, DESIGN: 4, INNOVATION: 4, COMPETITION: 3, CODING: 0.2, CONTEST: 0.2, QUIZ: 0.5 }[l.type] ?? 3;
  const days = daysLeft(l.deadline, now);
  if (days < need * 0.5) return { score: 0.15, note: days < 1 ? 'closes today, move fast' : `only ${Math.ceil(days)}d left, tight` };
  if (days < need) return { score: 0.55, note: `${Math.ceil(days)}d left, a little tight` };
  if (days <= 21) return { score: 1, note: days <= 7 ? `${Math.ceil(days)} days left, enough time` : `${Math.ceil(days)} days to prepare` };
  return { score: 0.75, note: `${Math.ceil(days)} days away` };
}

// Kept for API compatibility: rubric-style eligibility score
function eligibilityFit(l, user) {
  const e = eligibilityFor(l, user);
  return { score: e.score, note: e.note, eligible: e.eligible };
}

function preferenceFit(l, prefs = {}) {
  let score = 0.5;
  const reasons = [];
  if (prefs.modes?.length) {
    if (prefs.modes.includes(l.mode)) { score += 0.2; reasons.push(`${l.mode.toLowerCase()} as you prefer`); } else score -= 0.15;
  }
  if (prefs.types?.length) {
    if (prefs.types.includes(l.type)) { score += 0.2; reasons.push(`a ${l.type.toLowerCase()} listing`); } else score -= 0.1;
  }
  if (prefs.freeOnly && !/free/i.test(l.fee || '')) score -= 0.4;
  if (prefs.minPrizeInr) {
    if ((l.prizeInr || 0) >= prefs.minPrizeInr) { score += 0.2; reasons.push('meets your prize minimum'); } else if (l.prizeInr != null) score -= 0.2;
  }
  return { score: Math.max(0, Math.min(1, score)), reasons };
}

// Prize size (log-scaled) and how crowded it is. Smaller fields with real prizes are better value.
function valueScore(l) {
  const prize = l.prizeInr ? Math.min(1, Math.log10(l.prizeInr + 1) / 6.5) : 0.25;
  const crowd = l.registered ? 1 - Math.min(0.6, Math.log10(l.registered + 1) / 6) : 0.6;
  return 0.65 * prize + 0.35 * crowd;
}

const overlap = (a, b) => [...a].filter((x) => b.has(x));
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// Hard filters shared by both tiers. Returns { pool, excluded }
function hardFilter(user, listings, { now, excludeIds }) {
  const excluded = { expired: 0, ineligible: 0, duplicate: 0, saved: 0 };
  const pool = [];
  const elig = new Map();
  for (const l of listings) {
    if (excludeIds.has(String(l._id))) { excluded.saved++; continue; }
    if (!(new Date(l.deadline) >= now)) { excluded.expired++; continue; }
    const e = eligibilityFor(l, user);
    if (e.eligible === false) { excluded.ineligible++; continue; }
    elig.set(l, e);
    pool.push(l);
  }
  return { pool, excluded, elig };
}

function recommend(user, listings, { limit = 20, now = new Date(), excludeIds = new Set(), tier = 'pro', semantic = null, withMeta = false } = {}) {
  const p = userProfile(user);
  const { pool, excluded, elig } = hardFilter(user, listings, { now, excludeIds });
  const profiles = pool.map(listingProfile);

  // Semantic similarity: provided by the RAG layer (embeddings), or TF-IDF over text as a fallback
  let sem = () => 0;
  if (tier === 'pro') {
    if (semantic) sem = (i) => semantic.get(String(pool[i]._id)) ?? 0;
    else {
      const vecs = tfidfVectors([tokenize(p.text), ...profiles.map((x) => tokenize(x.text))]);
      sem = (i) => Math.min(1, cosineMap(vecs[0], vecs[i + 1]) * 2.5);
    }
  }

  const results = pool.map((l, i) => {
    const lp = profiles[i];
    const reasons = [];
    const detail = {};
    const matched = overlap(lp.skills, p.skills).sort();
    // A listing that names no skills is neither a match nor a mismatch
    const skillScore = lp.skills.size ? Math.min(1, matched.length / Math.min(lp.skills.size, 3)) : 0.35;
    detail.skills = !lp.skills.size ? 'listing names no specific skills' : matched.length ? `you have ${matched.slice(0, 4).join(', ')}` : `asks for ${[...lp.skills].slice(0, 3).join(', ')}`;
    if (matched.length) reasons.push(`matches your ${matched.slice(0, 3).join(', ')} skills`);

    let interestScore = 0;
    const domMatched = [];
    for (const d of [...lp.domains].sort()) {
      const w = p.domainWeights.get(d) || 0;
      if (w > 0) { domMatched.push(d); interestScore = Math.max(interestScore, Math.min(1, w * 1.6)); }
    }
    detail.interests = domMatched.length ? `in ${domMatched.slice(0, 2).join(', ')}` : lp.domains.size ? `about ${[...lp.domains].slice(0, 2).join(', ')}` : 'no clear domain';
    if (domMatched.length) reasons.push(`fits your ${domMatched[0]} focus`);

    const days = Math.ceil(daysLeft(l.deadline, now));
    const e = elig.get(l);
    let breakdown;
    let raw;
    let weights;

    if (tier === 'free') {
      const urg = urgencyScore(l.deadline, now);
      breakdown = { interests: interestScore, skills: skillScore, urgency: urg };
      weights = BASIC;
      detail.urgency = `${days} day${days === 1 ? '' : 's'} left`;
      raw = BASIC.interests * interestScore + BASIC.skills * skillScore + BASIC.urgency * urg;
      if (days <= 7) reasons.push(`closes in ${days} day${days === 1 ? '' : 's'}`);
      if (e.note && e.eligible === true) reasons.push(e.note);
    } else {
      const loc = locationFit(user, l);
      const pref = preferenceFit(l, user.preferences);
      const timing = timingFit(l, now);
      const value = valueScore(l);
      const s = clamp01(sem(i));
      if (loc.note && loc.score >= 0.7) reasons.push(loc.note);
      if (e.note) reasons.push(e.note);
      reasons.push(...pref.reasons);
      if (timing.note && (timing.score >= 1 || timing.score <= 0.15)) reasons.push(timing.note);
      if (loc.score <= 0.1 && loc.note) reasons.push(loc.note);
      breakdown = { skills: skillScore, semantic: s, interests: interestScore, location: loc.score, eligibility: e.score, preferences: pref.score, timing: timing.score, value };
      weights = RUBRIC;
      Object.assign(detail, {
        semantic: s >= 0.6 ? 'very similar to your profile' : s >= 0.3 ? 'somewhat similar to your profile' : 'not much like your profile',
        location: loc.note || (loc.score >= 0.5 ? '' : 'far from you'),
        eligibility: e.note || (e.eligible === null ? 'no stated restrictions' : ''),
        preferences: pref.reasons.join(', ') || (pref.score < 0.5 ? 'outside your stated preferences' : 'neutral'),
        timing: timing.note,
        value: `${l.prizeLabel && l.prizeLabel !== 'See listing' ? l.prizeLabel : 'prize not stated'}${l.registered ? `, ${l.registered.toLocaleString('en-IN')} registered` : ''}`,
      });
      raw = Object.entries(RUBRIC).reduce((sum, [k, w]) => sum + w * breakdown[k], 0);
      // Soft penalties: a listing you can't attend or may not qualify for shouldn't float to the top
      if (loc.score <= 0.05) raw *= 0.5; // in person in another country
      else if (loc.score <= 0.1) raw *= 0.75; // in person elsewhere and the user does not travel
      if (e.eligible === null && /check eligibility/.test(e.note)) raw *= 0.9;
      if (user.preferences?.freeOnly && !/free/i.test(l.fee || '')) raw *= 0.6;
    }
    const score = Math.round(clamp01(raw) * 100);
    const criteria = Object.entries(weights).map(([k, w]) => ({
      key: k, label: LABELS[k], weight: w, score: +breakdown[k].toFixed(2), points: +(w * breakdown[k] * 100).toFixed(1), detail: detail[k] || '',
    }));
    return {
      listing: l,
      tier,
      score,
      breakdown: Object.fromEntries(Object.entries(breakdown).map(([k, v]) => [k, +v.toFixed(2)])),
      criteria,
      eligibility: { eligible: e.eligible, note: e.note },
      matchedSkills: matched,
      missingSkills: [...lp.skills].filter((s) => !p.skills.has(s)).sort().slice(0, 4),
      reasons: [...new Set(reasons)].slice(0, 5),
    };
  });

  // Deterministic order: score, then sooner deadline, then id
  results.sort((a, b) => b.score - a.score || new Date(a.listing.deadline) - new Date(b.listing.deadline) || String(a.listing._id).localeCompare(String(b.listing._id)));

  // Suppress duplicates (e.g. a lister re-posting an event that is also ingested): keep the best-scored copy
  const out = [];
  const seen = new Map();
  for (const r of results) {
    const k = titleKey(r.listing.title);
    const prev = k.length >= 4 ? seen.get(k) : null;
    if (prev && Math.abs(new Date(prev.listing.deadline) - new Date(r.listing.deadline)) <= 10 * 86400000) { excluded.duplicate++; continue; }
    if (k.length >= 4) seen.set(k, r);
    out.push(r);
  }
  const top = out.slice(0, limit);
  if (withMeta) return { results: top, excluded, considered: pool.length };
  return top;
}

module.exports = { recommend, listingProfile, userProfile, tokenize, W, RUBRIC, BASIC, LABELS, timingFit, eligibilityFit, valueScore, urgencyScore, hardFilter };

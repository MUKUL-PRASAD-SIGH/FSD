// Explainable recommendation engine with two tiers.
//
// FREE (basic picks): uses only what the user typed in their profile (skills, interests, preferences).
//   score = 0.45 interests + 0.35 skills + 0.20 urgency
//
// PRO (rubric): uses the parsed resume, location, education and semantic similarity.
//   skills .22 | semantic .18 | interests .12 | location .14 | eligibility .08 | preferences .10 | timing .08 | value .08
//   Every dimension is in [0,1]; the response carries the per-dimension breakdown and plain-English reasons.
const { extractSkills, domainOf } = require('./skills');
const { locationFit } = require('../utils/geo');

const RUBRIC = { skills: 0.22, semantic: 0.18, interests: 0.12, location: 0.14, eligibility: 0.08, preferences: 0.1, timing: 0.08, value: 0.08 };
const BASIC = { interests: 0.45, skills: 0.35, urgency: 0.2 };
const W = RUBRIC; // kept for backwards compatibility

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
  [/machine learning|\bai\b|artificial|llm|deep learning/, 'AI/ML'], [/web|frontend|backend|full[- ]?stack/, 'Web Development'],
  [/blockchain|web3|crypto|defi/, 'Blockchain & Web3'], [/security|cyber|ctf/, 'Cybersecurity'], [/mobile|android|ios|flutter/, 'Mobile Development'],
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
  if (days < need) return { score: 0.55, note: '' };
  if (days <= 21) return { score: 1, note: days <= 7 ? `${Math.ceil(days)} days left, enough time` : '' };
  return { score: 0.75, note: '' };
}

// Matches the listing's stated audience against the user's education level and graduation year.
function eligibilityFit(l, user) {
  const el = (l.eligibility || []).join(' ').toLowerCase();
  const level = user.education?.level;
  if (!el || !level) return { score: 0.6, note: '' };
  const map = { school: /school/, undergraduate: /undergrad|graduate|college|student|engineering|b\.?tech/, postgraduate: /postgrad|post-grad|master|mba|m\.?tech|management/, phd: /phd|research/, working: /professional|working|startup/ };
  if (map[level]?.test(el)) return { score: 1, note: 'open to your education level' };
  if (/student|college|open to all|everyone|anyone/.test(el)) return { score: 0.7, note: '' };
  return { score: 0.15, note: 'may not be open to your education level' };
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

function overlap(a, b) { return [...a].filter((x) => b.has(x)); }

function recommend(user, listings, { limit = 20, now = new Date(), excludeIds = new Set(), tier = 'pro', semantic = null } = {}) {
  const p = userProfile(user);
  const pool = listings.filter((l) => new Date(l.deadline) >= now && !excludeIds.has(String(l._id)));
  const profiles = pool.map(listingProfile);

  // Semantic similarity: provided by the RAG layer (embeddings), or TF-IDF over text as a fallback
  let sem = (i) => 0;
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
    const matched = overlap(lp.skills, p.skills);
    const skillScore = lp.skills.size ? Math.min(1, matched.length / Math.min(lp.skills.size, 3)) : 0;
    if (matched.length) reasons.push(`matches your ${matched.slice(0, 3).join(', ')} skills`);

    let interestScore = 0;
    const domMatched = [];
    for (const d of lp.domains) {
      const w = p.domainWeights.get(d) || 0;
      if (w > 0) { domMatched.push(d); interestScore = Math.max(interestScore, Math.min(1, w * 1.6)); }
    }
    if (domMatched.length) reasons.push(`fits your ${domMatched[0]} focus`);

    const days = Math.ceil(daysLeft(l.deadline, now));
    let breakdown, raw;

    if (tier === 'free') {
      const urg = urgencyScore(l.deadline, now);
      breakdown = { interests: interestScore, skills: skillScore, urgency: urg };
      raw = BASIC.interests * interestScore + BASIC.skills * skillScore + BASIC.urgency * urg;
      if (days <= 7) reasons.push(`closes in ${days} day${days === 1 ? '' : 's'}`);
    } else {
      const loc = locationFit(user, l);
      const elig = eligibilityFit(l, user);
      const pref = preferenceFit(l, user.preferences);
      const timing = timingFit(l, now);
      const value = valueScore(l);
      const s = Math.max(0, Math.min(1, sem(i)));
      if (loc.note) reasons.push(loc.note);
      if (elig.note) reasons.push(elig.note);
      reasons.push(...pref.reasons);
      if (timing.note) reasons.push(timing.note);
      breakdown = { skills: skillScore, semantic: s, interests: interestScore, location: loc.score, eligibility: elig.score, preferences: pref.score, timing: timing.score, value };
      raw = Object.entries(RUBRIC).reduce((sum, [k, w]) => sum + w * breakdown[k], 0);
      // Hard penalties: a listing you can't attend or aren't eligible for shouldn't float to the top
      if (loc.score <= 0.1) raw *= 0.8;
      if (elig.score <= 0.15) raw *= 0.75;
      if (user.preferences?.freeOnly && !/free/i.test(l.fee || '')) raw *= 0.6;
    }
    return {
      listing: l,
      tier,
      score: Math.round(Math.max(0, Math.min(1, raw)) * 100),
      breakdown: Object.fromEntries(Object.entries(breakdown).map(([k, v]) => [k, +v.toFixed(2)])),
      matchedSkills: matched,
      missingSkills: [...lp.skills].filter((s) => !p.skills.has(s)).slice(0, 4),
      reasons: [...new Set(reasons)].slice(0, 5),
    };
  });

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

module.exports = { recommend, listingProfile, userProfile, tokenize, W, RUBRIC, BASIC, timingFit, eligibilityFit, valueScore };

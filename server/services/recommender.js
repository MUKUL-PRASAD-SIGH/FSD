// Explainable recommendation engine.
// Final score (0-100) = weighted blend of five signals, each in [0,1]:
//   skills    0.35  overlap between profile skills and the listing's skills/tags/title
//   interests 0.20  profile domains (from resume + user choices) vs listing domains
//   text      0.20  TF-IDF cosine between profile text and listing text
//   fit       0.15  mode / city / type / fee / prize preferences + eligibility
//   urgency   0.10  prefers listings you can still act on, closing soon but not too late
// Every result carries `reasons` so the UI can explain why it was recommended.
const { extractSkills, domainOf } = require('./skills');

const W = { skills: 0.35, interests: 0.2, text: 0.2, fit: 0.15, urgency: 0.1 };
const STOP = new Set('the a an and or of to in for on with at by from is are be as this that it we you your our will can all any new more open join build team event hackathon challenge competition'.split(' '));

const tokenize = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s/]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));

function tfidfVectors(docs) {
  const df = new Map();
  const tfs = docs.map((tokens) => {
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
    return tf;
  });
  const n = docs.length;
  const idf = (t) => Math.log((n + 1) / ((df.get(t) || 0) + 1)) + 1;
  return tfs.map((tf) => {
    const v = new Map();
    let norm = 0;
    for (const [t, c] of tf) {
      const w = (1 + Math.log(c)) * idf(t);
      v.set(t, w);
      norm += w * w;
    }
    return { v, norm: Math.sqrt(norm) || 1 };
  });
}

function cosine(a, b) {
  const [s, l] = a.v.size < b.v.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [t, w] of s.v) if (l.v.has(t)) dot += w * l.v.get(t);
  return dot / (a.norm * b.norm);
}

// Derive what a listing is "about" from its text so listings without explicit skills still work.
function listingProfile(l) {
  const text = `${l.title} ${l.description || ''} ${(l.tags || []).join(' ')} ${(l.skills || []).join(' ')}`;
  const found = extractSkills(text);
  const skills = new Set([...(l.skills || []), ...found.map((f) => f.name)]);
  const domains = new Set(found.map((f) => f.domain));
  for (const s of l.skills || []) { const d = domainOf(s); if (d) domains.add(d); }
  // Raw theme tags (Devpost themes) are matched against interests directly too
  const tagText = (l.tags || []).join(' ').toLowerCase();
  if (/machine learning|ai\b|artificial/.test(tagText)) domains.add('AI/ML');
  if (/web|frontend|backend/.test(tagText)) domains.add('Web Development');
  if (/blockchain|web3|crypto/.test(tagText)) domains.add('Blockchain & Web3');
  if (/security|cyber/.test(tagText)) domains.add('Cybersecurity');
  if (/mobile|android|ios/.test(tagText)) domains.add('Mobile Development');
  if (/data/.test(tagText)) domains.add('Data Science');
  if (/design|ux/.test(tagText)) domains.add('Design');
  if (/devops|cloud|infra/.test(tagText)) domains.add('Cloud & DevOps');
  if (/iot|hardware|robot/.test(tagText)) domains.add('Hardware & IoT');
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
  const text = [
    [...skills].join(' '),
    (user.interests || []).join(' '),
    user.bio || '',
    resume.text || '',
  ].join(' ');
  return { skills, domainWeights, text, prefs: user.preferences || {}, college: user.college };
}

function urgencyScore(deadline, now) {
  const days = (new Date(deadline) - now) / 86400000;
  if (days < 0) return 0;
  if (days <= 3) return 0.85; // last-minute: still actionable but risky
  if (days <= 14) return 1;
  if (days <= 45) return 0.7;
  return 0.4;
}

function fitScore(l, p) {
  const reasons = [];
  let score = 0.5;
  const prefs = p.prefs;
  if (prefs.modes?.length) {
    if (prefs.modes.includes(l.mode)) { score += 0.2; reasons.push(`${l.mode.toLowerCase()} as you prefer`); }
    else score -= 0.15;
  }
  if (prefs.cities?.length && l.mode !== 'ONLINE') {
    if (prefs.cities.some((c) => (l.city || '').toLowerCase().includes(c.toLowerCase()))) { score += 0.2; reasons.push(`in ${l.city}`); }
  }
  if (prefs.types?.length) {
    if (prefs.types.includes(l.type)) { score += 0.15; reasons.push(`a ${l.type.toLowerCase()} listing`); }
    else score -= 0.1;
  }
  if (prefs.freeOnly && !/free/i.test(l.fee || '')) score -= 0.3;
  if (prefs.minPrizeInr && (l.prizeInr || 0) >= prefs.minPrizeInr) { score += 0.15; reasons.push('meets your prize minimum'); }
  if (prefs.minPrizeInr && l.prizeInr != null && l.prizeInr < prefs.minPrizeInr) score -= 0.15;
  if ((l.eligibility || []).length && p.college) score += 0.05;
  return { score: Math.max(0, Math.min(1, score)), reasons };
}

// listings: lean Listing docs. user: User doc (with resume.text selected for best results).
function recommend(user, listings, { limit = 20, now = new Date(), excludeIds = new Set() } = {}) {
  const p = userProfile(user);
  const pool = listings.filter((l) => new Date(l.deadline) >= now && !excludeIds.has(String(l._id)));
  const profiles = pool.map(listingProfile);

  const vecs = tfidfVectors([tokenize(p.text), ...profiles.map((x) => tokenize(x.text))]);
  const userVec = vecs[0];

  const results = pool.map((l, i) => {
    const lp = profiles[i];
    const reasons = [];

    const matched = [...lp.skills].filter((s) => p.skills.has(s));
    const skillScore = lp.skills.size ? Math.min(1, matched.length / Math.min(lp.skills.size, 3)) : 0;
    if (matched.length) reasons.push(`matches your ${matched.slice(0, 3).join(', ')} skills`);

    let interestScore = 0;
    const domMatched = [];
    for (const d of lp.domains) {
      const w = p.domainWeights.get(d) || 0;
      if (w > 0) { domMatched.push(d); interestScore = Math.max(interestScore, Math.min(1, w * 1.6)); }
    }
    if (domMatched.length) reasons.push(`fits your ${domMatched[0]} focus`);

    const textScore = Math.min(1, cosine(userVec, vecs[i + 1]) * 2.5);
    const fit = fitScore(l, p);
    reasons.push(...fit.reasons);
    const urg = urgencyScore(l.deadline, now);
    const days = Math.ceil((new Date(l.deadline) - now) / 86400000);
    if (days <= 7) reasons.push(`closes in ${days} day${days === 1 ? '' : 's'}`);

    const raw = W.skills * skillScore + W.interests * interestScore + W.text * textScore + W.fit * fit.score + W.urgency * urg;
    return {
      listing: l,
      score: Math.round(raw * 100),
      breakdown: {
        skills: +skillScore.toFixed(2),
        interests: +interestScore.toFixed(2),
        text: +textScore.toFixed(2),
        fit: +fit.score.toFixed(2),
        urgency: +urg.toFixed(2),
      },
      matchedSkills: matched,
      missingSkills: [...lp.skills].filter((s) => !p.skills.has(s)).slice(0, 4),
      reasons: reasons.slice(0, 4),
    };
  });

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

module.exports = { recommend, listingProfile, userProfile, tokenize, W };

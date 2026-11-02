// Recommendation quality against realistic student profiles. Each profile states what a sensible advisor would
// recommend and what must never be shown. Deterministic: fixed `now`, no network, no database.
const test = require('node:test');
const assert = require('node:assert/strict');
const { recommend, RUBRIC } = require('../services/recommender');
const { eligibilityFor } = require('../services/eligibility');

const NOW = new Date('2026-11-02T06:00:00Z');
const day = (n) => new Date(NOW.getTime() + n * 86400000);
const L = (id, o) => ({ _id: id, title: id, organiser: '', description: '', type: 'HACKATHON', mode: 'ONLINE', fee: 'Free', city: '', tags: [], skills: [], eligibility: [], deadline: day(12), prizeLabel: 'See listing', prizeInr: null, registered: null, ...o });

const CATALOGUE = [
  L('ai-online', { title: 'GenAI Build Sprint', tags: ['Machine Learning/AI', 'LLM'], skills: ['Python', 'LLM', 'NLP'], prizeInr: 300000, prizeLabel: '₹3 L', eligibility: ['Engineering Students'], registered: 900 }),
  L('ai-pune', { title: 'Pune Vision Hack', mode: 'OFFLINE', city: 'Pune', tags: ['Computer Vision'], skills: ['Python', 'PyTorch', 'Computer Vision'], prizeInr: 150000, prizeLabel: '₹1.5 L', eligibility: ['College students'] }),
  L('ai-repost', { title: 'GenAI Build Sprint 2026', source: 'manual', tags: ['AI'], skills: ['Python', 'LLM'], deadline: day(13) }), // duplicate of ai-online
  L('web-blr', { title: 'Full Stack Fest', mode: 'OFFLINE', city: 'Bengaluru', tags: ['Web'], skills: ['React', 'Node.js', 'MongoDB'], prizeInr: 200000, prizeLabel: '₹2 L', eligibility: ['Undergraduate'] }),
  L('web-online', { title: 'Frontend Frenzy', tags: ['Web', 'UI'], skills: ['React', 'JavaScript', 'HTML/CSS'], deadline: day(5) }),
  L('web3-bkk', { title: 'ETHGlobal Bangkok', mode: 'OFFLINE', city: 'Bangkok', country: 'Thailand', tags: ['Web3'], skills: ['Blockchain'], prizeInr: 4000000, prizeLabel: '$50,000' }),
  L('mlh-boston', { title: 'HackBoston', mode: 'OFFLINE', city: 'Boston', state: 'MA', tags: ['MLH'], skills: ['Python'], eligibility: ['University students'], deadline: day(20) }),
  L('hs-delhi', { title: 'Teen Hacks Delhi', mode: 'OFFLINE', city: 'New Delhi', eligibility: ['High school students'], tags: ['Beginner'], skills: ['Python'] }),
  L('mba-case', { type: 'CASE STUDY', title: 'Strategy Case Challenge', tags: ['Consulting', 'Strategy'], skills: ['Consulting', 'Finance'], eligibility: ['MBA', 'PGDM'], prizeInr: 500000, prizeLabel: '₹5 L', deadline: day(9) }),
  L('batch-2026', { type: 'CODING', title: 'Hiring Code Sprint', skills: ['DSA', 'Java'], eligibility: ['2026 batch only'], deadline: day(4) }),
  L('cf-round', { type: 'CODING', title: 'Codeforces Round 1001 (Div. 2)', skills: ['DSA'], tags: ['Algorithms'], deadline: day(2), deadlineKind: 'event_start' }),
  L('kaggle', { type: 'COMPETITION', title: 'Retail Demand Forecasting', tags: ['Data Science', 'tabular'], skills: ['Machine Learning', 'Python', 'Pandas'], prizeInr: 2100000, prizeLabel: '$25,000', deadline: day(60), registered: 3000 }),
  L('design', { type: 'DESIGN', title: 'UX Redesign Challenge', tags: ['Design'], skills: ['UI/UX'], deadline: day(10) }),
  L('women', { title: 'Women Who Code Hack', tags: ['Web'], skills: ['React'], eligibility: ['Women only'] }),
  L('paid-quiz', { type: 'QUIZ', title: 'General Quiz Open', fee: 'Paid', eligibility: ['Open to all'] }),
  L('expired', { title: 'Old AI Hack', skills: ['Python', 'LLM'], deadline: day(-1) }),
];

const PROFILES = {
  asha: { name: 'Asha', skills: ['Python', 'PyTorch', 'NLP'], interests: ['AI/ML'], education: { level: 'undergraduate', gradYear: 2027 }, location: { city: 'Pune', state: 'Maharashtra', country: 'India' }, preferences: { modes: ['ONLINE'], willingToTravel: false }, resume: { skills: ['LLM', 'Computer Vision'], domains: [{ name: 'AI/ML', score: 0.8 }] } },
  rohan: { name: 'Rohan', skills: ['React', 'Node.js', 'MongoDB', 'JavaScript'], interests: ['Web Development'], education: { level: 'undergraduate', gradYear: 2028 }, location: { city: 'Bengaluru', state: 'Karnataka', country: 'India' }, preferences: { willingToTravel: true } },
  meera: { name: 'Meera', skills: ['Finance', 'Consulting', 'Excel'], interests: ['Business'], education: { level: 'postgraduate', gradYear: 2027 }, location: { city: 'Mumbai', state: 'Maharashtra', country: 'India' }, preferences: {} },
  kabir: { name: 'Kabir', skills: ['Python'], interests: ['AI/ML'], education: { level: 'school', gradYear: 2028 }, location: { city: 'Delhi', country: 'India' }, preferences: {} },
  dev: { name: 'Dev', skills: ['DSA', 'C++', 'Java'], interests: ['Competitive Programming'], education: { level: 'undergraduate', gradYear: 2026 }, location: { city: 'Hyderabad', country: 'India' }, preferences: { types: ['CODING'] } },
  blank: { name: 'New user', skills: [], interests: [], preferences: {} },
};

const run = (who, tier = 'pro', extra = {}) => recommend(PROFILES[who], CATALOGUE, { now: NOW, tier, limit: 50, withMeta: true, ...extra });
const ids = (r) => r.results.map((x) => x.listing._id);
const rank = (r, id) => ids(r).indexOf(id);

test('eligibility reader: levels, batches, open, uncheckable conditions', () => {
  const u = (level, gradYear) => ({ education: { level, gradYear } });
  const e = (elig, user) => eligibilityFor({ eligibility: elig }, user).eligible;
  assert.equal(e(['High school students'], u('undergraduate')), false);
  assert.equal(e(['High school students'], u('school')), true);
  assert.equal(e(['Engineering Students'], u('undergraduate')), true);
  assert.equal(e(['Engineering Students'], u('postgraduate')), true, 'M.Tech students are engineering students');
  assert.equal(e(['Engineering Students'], u('school')), false);
  assert.equal(e(['MBA', 'PGDM'], u('undergraduate')), false);
  assert.equal(e(['Undergraduate'], u('postgraduate')), false);
  assert.equal(e(['2026 batch only'], u('undergraduate', 2027)), false);
  assert.equal(e(['2026 batch only'], u('undergraduate', 2026)), true);
  assert.equal(e(['Final year students, 2026 & 2027 batch'], u('undergraduate', 2027)), true);
  assert.equal(e(['Open to all'], u('school')), true);
  assert.equal(e(['Women only'], u('undergraduate')), null, 'cannot be checked from the profile, so kept and flagged');
  assert.equal(e([], u('undergraduate')), null);
  assert.equal(e(['University students'], u('')), null, 'unknown education never hard-excludes');
});

test('Asha (AI/ML undergrad in Pune, online only): AI listings first, nothing she cannot enter', () => {
  const r = run('asha');
  assert.deepEqual(ids(r).slice(0, 2).sort(), ['ai-online', 'ai-pune'].sort());
  assert.ok(rank(r, 'kaggle') < rank(r, 'design'));
  for (const no of ['hs-delhi', 'mba-case', 'batch-2026', 'expired', 'ai-repost']) assert.equal(rank(r, no), -1, no);
  assert.ok(rank(r, 'mlh-boston') > ids(r).length / 2, 'an in-person event abroad sinks');
  assert.deepEqual(r.excluded, { expired: 1, ineligible: 3, duplicate: 1, saved: 0 });
  const top = r.results[0];
  assert.ok(top.reasons.length >= 2);
  assert.ok(top.reasons.some((x) => /skills/.test(x)));
});

test('Rohan (web dev in Bengaluru, travels): web listings first; city match beats distance', () => {
  const r = run('rohan');
  assert.deepEqual(ids(r).slice(0, 2).sort(), ['web-blr', 'web-online'].sort());
  const blr = r.results.find((x) => x.listing._id === 'web-blr');
  assert.equal(blr.breakdown.location, 1);
  assert.ok(blr.reasons.some((x) => /your city/.test(x)));
});

test('Meera (MBA in Mumbai): case competition on top; undergrad-only listings excluded', () => {
  const r = run('meera');
  assert.equal(ids(r)[0], 'mba-case');
  assert.equal(rank(r, 'web-blr'), -1);
  assert.equal(rank(r, 'hs-delhi'), -1);
});

test('Kabir (school student in Delhi): only school-friendly events, local HS hackathon first', () => {
  const r = run('kabir');
  assert.equal(ids(r)[0], 'hs-delhi');
  for (const no of ['ai-online', 'ai-pune', 'mba-case', 'web-blr', 'mlh-boston']) assert.equal(rank(r, no), -1, no);
});

test('Dev (2026 competitive programmer): contests first, batch-restricted sprint allowed for his batch', () => {
  const r = run('dev');
  assert.deepEqual(ids(r).slice(0, 2).sort(), ['batch-2026', 'cf-round'].sort());
});

test('blank profile still gets a sane list, with low scores and no crash', () => {
  for (const tier of ['free', 'pro']) {
    const r = run('blank', tier);
    assert.ok(r.results.length >= 10);
    assert.ok(r.results.every((x) => x.score <= 60), tier);
  }
});

test('free tier: basic criteria only, same hard filters', () => {
  const r = run('asha', 'free');
  assert.deepEqual(Object.keys(r.results[0].breakdown).sort(), ['interests', 'skills', 'urgency']);
  assert.equal(rank(r, 'hs-delhi'), -1);
  assert.equal(rank(r, 'expired'), -1);
  assert.ok(['ai-online', 'ai-pune'].includes(ids(r)[0]));
});

test('scores are 0-100 integers, criteria explain the score, results are deterministic and order-independent', () => {
  const a = run('asha');
  for (const x of a.results) {
    assert.ok(Number.isInteger(x.score) && x.score >= 0 && x.score <= 100);
    assert.equal(x.criteria.length, Object.keys(RUBRIC).length);
    const pts = x.criteria.reduce((s, c) => s + c.points, 0);
    assert.ok(x.score <= Math.round(pts) + 1, 'penalties can only lower the score');
    for (const c of x.criteria) assert.ok(c.label && typeof c.detail === 'string');
  }
  const b = recommend(PROFILES.asha, [...CATALOGUE].reverse(), { now: NOW, tier: 'pro', limit: 50, withMeta: true });
  assert.deepEqual(ids(b), ids(a));
  assert.deepEqual(b.results.map((x) => x.score), a.results.map((x) => x.score));
  assert.equal(new Set(ids(a)).size, ids(a).length, 'no listing twice');
});

test('saved listings are excluded and counted', () => {
  const r = run('asha', 'pro', { excludeIds: new Set(['ai-online']) });
  assert.equal(rank(r, 'ai-online'), -1);
  assert.equal(r.excluded.saved, 1);
  assert.ok(rank(r, 'ai-repost') >= 0, 'with the original saved, its re-post is no longer a duplicate of a shown item');
});

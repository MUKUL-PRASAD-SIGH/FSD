const test = require('node:test');
const assert = require('node:assert');
const { parseResumeText } = require('../services/resumeParser');
const { extractSkills } = require('../services/skills');
const { recommend } = require('../services/recommender');
const { parseAsk } = require('../services/askParser');

const RESUME = `Asha Rao
B.Tech Computer Science, Sample Institute, 2027
Skills
Python, PyTorch, NLP, React, Docker
Projects
Built a RAG chatbot with LangChain. Hackathon finalist. github.com/asha`;

test('skill matching is word-bounded', () => {
  const names = extractSkills('I know JavaScript and C++').map((s) => s.name);
  assert.ok(names.includes('JavaScript'));
  assert.ok(names.includes('C++'));
  assert.ok(!names.includes('Java'), 'java must not match inside javascript');
});

test('resume parser finds skills, top domain, grad year and signals', () => {
  const p = parseResumeText(RESUME);
  for (const s of ['Python', 'PyTorch', 'NLP', 'React', 'Docker', 'LLM']) assert.ok(p.skills.includes(s), s);
  assert.strictEqual(p.domains[0].name, 'AI/ML');
  assert.strictEqual(p.graduationYear, 2027);
  assert.ok(p.experienceKeywords.includes('hackathon'));
});

const day = (n) => new Date(Date.now() + n * 86400000);
const listing = (id, o) => ({ _id: id, title: id, organiser: '', description: '', type: 'HACKATHON', mode: 'ONLINE', fee: 'Free', tags: [], skills: [], eligibility: [], deadline: day(10), ...o });

test('recommender ranks matching listings first and explains why', () => {
  const user = { skills: ['Python', 'PyTorch'], interests: ['AI/ML'], resume: { skills: ['NLP'], domains: [{ name: 'AI/ML', score: 0.8 }] }, preferences: {} };
  const out = recommend(user, [
    listing('cook', { title: 'Cooking showdown', tags: ['Food'], type: 'QUIZ' }),
    listing('ai', { title: 'LLM hackathon', skills: ['Python', 'LLM', 'NLP'], tags: ['Machine Learning/AI'] }),
  ]);
  assert.strictEqual(out[0].listing._id, 'ai');
  assert.ok(out[0].score > out[1].score);
  assert.ok(out[0].reasons.some((r) => /skills/.test(r)));
});

test('recommender drops closed listings and respects free-only preference', () => {
  const user = { skills: ['Python'], interests: [], preferences: { freeOnly: true } };
  const out = recommend(user, [
    listing('closed', { deadline: day(-1), skills: ['Python'] }),
    listing('paid', { fee: '₹500', skills: ['Python'] }),
    listing('free', { skills: ['Python'] }),
  ]);
  assert.ok(!out.find((r) => r.listing._id === 'closed'));
  assert.strictEqual(out[0].listing._id, 'free');
});

test('ask parser reads type, mode, prize and urgency', () => {
  const p = parseAsk('online case competitions closing soon with 1L+ prize');
  assert.strictEqual(p.filter.type, 'CASE STUDY');
  assert.strictEqual(p.filter.mode, 'ONLINE');
  assert.strictEqual(p.filter.prizeInr.$gte, 100000);
  assert.ok(p.filter.deadline.$lte);
});

test('ask filters apply in memory the same way as in Mongo', () => {
  const { parseAsk, matchesFilter } = require('../services/askParser');
  const f = parseAsk('free online hackathons closing soon with 1L+ prize').filter;
  const ok = { type: 'HACKATHON', mode: 'ONLINE', fee: 'Free', prizeInr: 200000, deadline: new Date(Date.now() + 2 * 86400000) };
  assert.ok(matchesFilter(ok, f));
  assert.ok(!matchesFilter({ ...ok, mode: 'OFFLINE' }, f));
  assert.ok(!matchesFilter({ ...ok, prizeInr: 5000 }, f));
  assert.ok(!matchesFilter({ ...ok, deadline: new Date(Date.now() + 30 * 86400000) }, f));
});

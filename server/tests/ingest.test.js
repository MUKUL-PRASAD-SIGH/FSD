const test = require('node:test');
const assert = require('node:assert');
const { normalise, isOpen, rupees, stripHtml } = require('../services/ingest/common');
const contests = require('../services/ingest/sources/contests');

test('normalise derives skills from title/tags and stringifies ids', () => {
  const n = normalise({ externalId: 42, title: 'PyTorch vision hackathon', tags: ['Docker'], description: 'Build with React' });
  assert.strictEqual(n.externalId, '42');
  for (const s of ['PyTorch', 'Docker', 'React']) assert.ok(n.skills.includes(s), s);
  assert.strictEqual(n.mode, 'ONLINE');
});

test('isOpen rejects past, invalid and non-date deadlines', () => {
  assert.ok(isOpen(new Date(Date.now() + 1000)));
  assert.ok(!isOpen(new Date(Date.now() - 1000)));
  assert.ok(!isOpen(new Date('nope')));
  assert.ok(!isOpen(undefined));
});

test('formatting helpers', () => {
  assert.strictEqual(rupees(150000), '₹1.5 L');
  assert.strictEqual(rupees(20000000), '₹2 Cr');
  assert.strictEqual(rupees(25000000), '₹2.5 Cr');
  assert.strictEqual(stripHtml('<p>Hi&nbsp;<b>there</b></p>'), 'Hi there');
});

test('contest adapters are registered with unique names', () => {
  assert.deepStrictEqual(contests.map((c) => c.name), ['codeforces', 'codechef', 'leetcode']);
});

test('every registered source has a unique name and a fetchListings function', () => {
  const { SOURCES } = require('../services/ingest/run');
  const names = SOURCES.map((s) => s.name);
  assert.strictEqual(new Set(names).size, names.length);
  for (const s of SOURCES) assert.strictEqual(typeof s.fetchListings, 'function', s.name);
  assert.ok(names.length >= 16);
});

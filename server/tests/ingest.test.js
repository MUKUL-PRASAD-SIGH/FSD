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
  assert.strictEqual(rupees(20000000), '₹2.0 Cr');
  assert.strictEqual(stripHtml('<p>Hi&nbsp;<b>there</b></p>'), 'Hi there');
});

test('contest adapters are registered with unique names', () => {
  assert.deepStrictEqual(contests.map((c) => c.name), ['codeforces', 'codechef', 'leetcode']);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAsk, parsePlace, matchesPlace, matchesFilter } = require('../services/askParser');

const L = (o) => ({ type: 'HACKATHON', mode: 'OFFLINE', deadline: new Date(Date.now() + 86400000), ...o });

test('a named place is parsed: Indian city aliases, countries, and free-text places', () => {
  assert.equal(parsePlace('bangalore hackathons').key, 'bengaluru');
  assert.equal(parsePlace('hackathons in BLR').key, 'bengaluru');
  assert.deepEqual([parsePlace('hackathons in the USA').kind, parsePlace('hackathons in the USA').key], ['country', 'united states']);
  assert.equal(parsePlace('hackathons in Dhaka closing soon').key, 'dhaka');
  assert.equal(parsePlace('ai hackathons closing soon'), null, 'no place, no filter');
  assert.equal(parsePlace('hackathons in person'), null, '"in person" is a mode, not a place');
});

test('place is a hard filter: Bangalore never returns Dhaka, online queries stay location-agnostic', () => {
  const p = parseAsk('bangalore hackathons');
  assert.ok(p.applied.includes('in Bengaluru'));
  const blr = L({ title: 'Build BLR', city: 'Bangalore' });
  const dhaka = L({ title: 'Dhaka Hack', city: 'Dhaka', country: 'Bangladesh' });
  const online = L({ title: 'Global Hack', mode: 'ONLINE' });
  const ok = (l) => matchesFilter(l, p.filter) && matchesPlace(l, p.place);
  assert.equal(ok(blr), true); assert.equal(ok(dhaka), false); assert.equal(ok(online), false);
  const o = parseAsk('online hackathons in india');
  assert.equal(o.place, null);
  assert.equal(matchesFilter(online, o.filter), true);
  assert.equal(matchesPlace(L({ title: 'IBM Qiskit Hackathon - Bangladesh', city: 'BRAC University' }), parsePlace('hackathons in dhaka')), false);
  assert.equal(matchesPlace(L({ city: 'Seattle', state: 'WA' }), parsePlace('events in usa')), true);
});

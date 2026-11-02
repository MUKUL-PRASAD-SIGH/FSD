// Runner persistence against a real MongoDB in an isolated database (hackelite_ingest_test, dropped afterwards).
process.env.NODE_ENV = 'test';
process.env.MONGO_DB_NAME = 'hackelite_ingest_test';
process.env.JWT_SECRET = 'ingest-test-secret-ingest-test-secret-0123456789';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Listing = require('../models/Listing');
const Saved = require('../models/Saved');
const User = require('../models/User');
const SourceSync = require('../models/SourceSync');
const { runAll } = require('../services/ingest/run');

const DAY = 86400000;
const soon = (n) => new Date(Date.now() + n * DAY);
const rec = (id, title, url, extra = {}) => ({ externalId: id, title, url, deadline: soon(5), ...extra });
// Adapter whose output and pagination outcome the test controls
const adapter = (name, state) => ({ name, label: name, fetchListings: async ({ pages }) => { pages.page(); if (state.complete) pages.done(true); else pages.hitCap(); if (state.fail) throw new Error('down'); return state.rows; } });

test.before(async () => { await connectDB(); await mongoose.connection.dropDatabase(); await Listing.init(); });
test.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

test('runner upserts, removes stale only after a complete sync, merges duplicates and keeps saved items', async () => {
  await Listing.create({ title: 'Seed', url: 'https://seed.example.org', deadline: soon(3), source: 'seed', externalId: 'seed1' });
  const user = await User.create({ name: 'Saver', email: 'saver@example.com', password: 'Str0ng-Passw0rd!9' });
  const a = { complete: true, rows: [rec('a1', 'Alpha Hack', 'https://alpha.example.org'), rec('a2', 'Beta Hack', 'https://beta.example.org')] };
  const b = { complete: true, rows: [rec('b1', 'Gamma Cup', 'https://gamma.example.org')] };

  let r = await runAll({ adapters: [adapter('unstop', a), adapter('clist', b)], only: [] });
  assert.equal(await Listing.countDocuments({ source: { $in: ['unstop', 'clist'] } }), 3);
  assert.equal(await Listing.countDocuments({ source: 'seed' }), 0, 'seed rows go once live data lands');
  assert.equal(r.sources.length, 2);
  assert.equal(await SourceSync.countDocuments({ runId: r.runId }), 2);

  // Users save Gamma (from the aggregator) and Beta
  const gamma = await Listing.findOne({ source: 'clist', externalId: 'b1' });
  const beta = await Listing.findOne({ source: 'unstop', externalId: 'a2' });
  await Saved.create({ user: user._id, listing: gamma._id, status: 'applied' });
  await Saved.create({ user: user._id, listing: beta._id });

  // Next run: unstop now also lists Gamma (native beats aggregator) and dropped Beta and Alpha's sibling
  a.rows = [rec('a1', 'Alpha Hack', 'https://alpha.example.org'), rec('a3', 'Gamma Cup', 'https://gamma.example.org', { prizeInr: 5000 })];
  r = await runAll({ adapters: [adapter('unstop', a), adapter('clist', b)], only: [] });
  const g = await Listing.findOne({ title: 'Gamma Cup' }).lean();
  assert.equal(await Listing.countDocuments({ title: 'Gamma Cup' }), 1, 'no duplicate listing');
  assert.equal(g.source, 'unstop');
  assert.deepEqual(g.alsoOn.map((x) => x.source), ['clist']);
  const moved = await Saved.findOne({ user: user._id, listing: g._id }).lean();
  assert.equal(moved?.status, 'applied', 'the tracker entry follows the merged listing');
  assert.ok(await Listing.exists({ _id: beta._id }), 'a saved listing is never removed as stale');
  const clistRow = r.sources.find((s) => s.source === 'clist');
  assert.equal(clistRow.duplicates, 1);
  assert.equal(clistRow.stored, 0);

  // Incomplete pagination: nothing is removed even though Alpha is missing from the feed
  a.complete = false; a.rows = [rec('a3', 'Gamma Cup', 'https://gamma.example.org')];
  r = await runAll({ adapters: [adapter('unstop', a)], only: [] });
  assert.ok(await Listing.exists({ source: 'unstop', externalId: 'a1' }));
  assert.equal(r.sources[0].status, 'partial');
  assert.equal(r.sources[0].removedStale, 0);

  // Complete again: Alpha is now stale and removed
  a.complete = true;
  r = await runAll({ adapters: [adapter('unstop', a)], only: [] });
  assert.equal(await Listing.exists({ source: 'unstop', externalId: 'a1' }), null);
  assert.equal(r.sources[0].removedStale, 1);

  // A failing source removes nothing and is recorded
  r = await runAll({ adapters: [adapter('unstop', { complete: true, fail: true, rows: [] })], only: [] });
  assert.equal(r.sources[0].status, 'failed');
  assert.ok(await Listing.exists({ title: 'Gamma Cup' }));
});

test('admin-unpublished listings stay unpublished after re-ingest', async () => {
  const s = { complete: true, rows: [rec('m1', 'Moderated Hack', 'https://mod.example.org')] };
  await runAll({ adapters: [adapter('devpost', s)], only: [] });
  await Listing.updateOne({ source: 'devpost', externalId: 'm1' }, { $set: { status: 'unpublished' } });
  await runAll({ adapters: [adapter('devpost', s)], only: [] });
  assert.equal((await Listing.findOne({ source: 'devpost', externalId: 'm1' })).status, 'unpublished');
});

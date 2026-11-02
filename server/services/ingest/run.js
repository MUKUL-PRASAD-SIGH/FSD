// Ingestion runner.
//   1. Every enabled adapter runs independently (Promise.allSettled): one failing source never blocks another.
//   2. Each raw record is validated (validate.js) -> valid | expired | rejected(reason).
//   3. Valid records from all sources are de-duplicated across sources (dedupe.js).
//   4. Primaries are upserted; merged duplicates are removed (saved-tracker entries are moved to the primary);
//      listings a source no longer returns are removed only when that source's pagination was complete.
//   5. A SourceSync document per source records counts, pagination completeness and errors for the dashboard.
// ENABLED_SOURCES=unstop,devfolio limits a run.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env'), quiet: true });
const crypto = require('crypto');
const mongoose = require('mongoose');
const Listing = require('../../models/Listing');
const Saved = require('../../models/Saved');
const SourceSync = require('../../models/SourceSync');
const { pageTracker } = require('./http');
const { validate } = require('./validate');
const { dedupe } = require('./dedupe');

const SOURCES = [
  require('./sources/devpost'),
  require('./sources/unstop'),
  require('./sources/devfolio'),
  require('./sources/hackerearth'),
  ...require('./sources/contests'),
  require('./sources/mlh'),
  require('./sources/hackclub'),
  require('./sources/ethglobal'),
  require('./sources/dorahacks'),
  require('./sources/kaggle'),
  require('./sources/atcoder'),
  require('./sources/topcoder'),
  require('./sources/geeksforgeeks'),
  require('./sources/clist'),
];

const SAMPLE_LIMIT = 10;

// Runs one adapter and classifies every record. Never throws.
async function collect(adapter, { now }) {
  const startedAt = new Date();
  const base = { source: adapter.name, label: adapter.label || adapter.name, startedAt };
  const gate = adapter.enabled ? adapter.enabled() : { ok: true };
  if (!gate.ok) return { ...base, status: 'skipped', skippedReason: gate.reason, finishedAt: new Date(), valid: [], counts: emptyCounts(), pages: null };

  const pages = pageTracker();
  let raw = [];
  let error = '';
  try {
    raw = (await adapter.fetchListings({ pages, now })) || [];
  } catch (e) {
    error = e.message || String(e);
    raw = e.partial || []; // adapters may attach what they collected before failing
  }
  const counts = emptyCounts();
  counts.raw = raw.length;
  const valid = [];
  const seenIds = new Set();
  for (const r of raw) {
    const v = validate(r, { now });
    if (v.status === 'expired') { counts.expired++; continue; }
    if (v.status === 'rejected') {
      counts.rejected++;
      counts.rejectReasons[v.reason] = (counts.rejectReasons[v.reason] || 0) + 1;
      if (counts.rejectSamples.length < SAMPLE_LIMIT) counts.rejectSamples.push({ reason: v.reason, title: String(r?.title || '').slice(0, 120), externalId: String(r?.externalId ?? '').slice(0, 120) });
      continue;
    }
    if (seenIds.has(v.item.externalId)) { counts.duplicates++; continue; }
    seenIds.add(v.item.externalId);
    valid.push(v.item);
  }
  const snap = pages.snapshot();
  const status = error ? (raw.length ? 'partial' : 'failed') : snap.capped ? 'partial' : 'ok';
  return { ...base, status, error, finishedAt: new Date(), valid, counts, pages: snap };
}

const emptyCounts = () => ({ raw: 0, expired: 0, rejected: 0, duplicates: 0, rejectReasons: {}, rejectSamples: [] });

// Moves tracker entries from a listing that is about to be removed onto the listing that replaces it.
async function moveSaved(fromId, toId) {
  if (!fromId || !toId || String(fromId) === String(toId)) return;
  const rows = await Saved.find({ listing: fromId }).lean();
  for (const r of rows) {
    const clash = await Saved.exists({ user: r.user, listing: toId });
    if (clash) await Saved.deleteOne({ _id: r._id });
    else await Saved.updateOne({ _id: r._id }, { $set: { listing: toId } });
  }
}

async function persist(runId, collected, kept, duplicates, startedAt) {
  // Upsert primaries
  const ops = kept.map(({ source, item }) => ({
    updateOne: {
      filter: { source, externalId: item.externalId },
      update: { $set: { ...item, alsoOn: item.alsoOn || [], source, refreshedAt: new Date() }, $setOnInsert: { status: 'published' } },
      upsert: true,
    },
  }));
  for (let i = 0; i < ops.length; i += 500) await Listing.bulkWrite(ops.slice(i, i + 500), { ordered: false });

  // Remove stored copies of records that are now duplicates of another source's primary
  for (const d of duplicates) {
    const old = await Listing.findOne({ source: d.source, externalId: d.item.externalId }).select('_id').lean();
    if (!old) continue;
    const primary = await Listing.findOne({ source: d.of.source, externalId: d.of.externalId }).select('_id').lean();
    await moveSaved(old._id, primary?._id);
    await Listing.deleteOne({ _id: old._id });
  }

  // Remove listings a source stopped returning, but only when we know we saw the whole feed
  const removed = {};
  for (const c of collected) {
    removed[c.source] = 0;
    if (c.status !== 'ok' || !c.pages?.complete) continue;
    const savedIds = await Saved.distinct('listing');
    const r = await Listing.deleteMany({ source: c.source, refreshedAt: { $lt: startedAt }, _id: { $nin: savedIds } });
    removed[c.source] = r.deletedCount || 0;
  }
  return removed;
}

async function runAll({ only = (process.env.ENABLED_SOURCES || '').split(',').map((s) => s.trim()).filter(Boolean), adapters = SOURCES, now = new Date(), save = true } = {}) {
  const runId = crypto.randomUUID();
  const startedAt = new Date();
  const chosen = adapters.filter((a) => !only.length || only.includes(a.name));
  const settled = await Promise.allSettled(chosen.map((a) => collect(a, { now })));
  const collected = settled.map((s, i) => (s.status === 'fulfilled' ? s.value : { source: chosen[i].name, label: chosen[i].label, status: 'failed', error: String(s.reason?.message || s.reason), valid: [], counts: emptyCounts(), pages: null, startedAt, finishedAt: new Date() }));

  const { kept, duplicates } = dedupe(collected.flatMap((c) => c.valid.map((item) => ({ source: c.source, item }))));
  const dupBySource = {};
  for (const d of duplicates) dupBySource[d.source] = (dupBySource[d.source] || 0) + 1;
  const keptBySource = {};
  for (const k of kept) keptBySource[k.source] = (keptBySource[k.source] || 0) + 1;

  let removed = {};
  if (save) {
    removed = await persist(runId, collected, kept, duplicates, startedAt);
    await Listing.deleteMany({ deadline: { $lt: new Date() }, source: { $ne: 'manual' } });
    if (kept.length > 0) await Listing.deleteMany({ source: 'seed' });
  }

  const summary = {};
  const docs = [];
  for (const c of collected) {
    const row = {
      source: c.source, label: c.label, runId, status: c.status, error: c.error || '', skippedReason: c.skippedReason || '',
      startedAt: c.startedAt, finishedAt: c.finishedAt, durationMs: c.finishedAt - c.startedAt,
      raw: c.counts.raw, valid: c.valid.length, expired: c.counts.expired, rejected: c.counts.rejected,
      duplicates: c.counts.duplicates + (dupBySource[c.source] || 0), stored: keptBySource[c.source] || 0,
      removedStale: removed[c.source] || 0, rejectReasons: c.counts.rejectReasons, rejectSamples: c.counts.rejectSamples, pages: c.pages,
    };
    docs.push(row);
    summary[c.source] = c.status === 'skipped' ? `skipped: ${c.skippedReason}` : c.status === 'failed' ? `failed: ${c.error}` : `${row.stored} stored (${row.raw} raw, ${row.expired} expired, ${row.duplicates} dup, ${row.rejected} rejected)${c.status === 'partial' ? ` partial: ${c.error || 'page cap reached'}` : ''}`;
  }
  if (save) await SourceSync.insertMany(docs);
  return { runId, summary, totals: { stored: kept.length, duplicates: duplicates.length }, sources: docs };
}

module.exports = { runAll, collect, SOURCES };

if (require.main === module) {
  const connectDB = require('../../config/db');
  connectDB()
    .then(() => runAll())
    .then((r) => { console.log('Ingest finished:', JSON.stringify(r.summary, null, 2)); return mongoose.disconnect(); })
    .catch((e) => { console.error(e); process.exit(1); });
}

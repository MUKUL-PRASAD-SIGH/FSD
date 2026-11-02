// Live source check: runs every adapter against the real sites WITHOUT touching the database and prints the
// coverage table (raw / valid / expired / duplicates / rejected / pages). Run this from a machine with internet access.
//   npm run sources:check                 all sources
//   npm run sources:check -- devpost mlh  only these
//   npm run sources:check -- --record     also save every raw response under tests/fixtures/live/<source>/
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
const { runAll, SOURCES } = require('../services/ingest/run');

const args = process.argv.slice(2);
const record = args.includes('--record');
const only = args.filter((a) => !a.startsWith('--'));

if (record) {
  const real = globalThis.fetch;
  const counter = {};
  globalThis.fetch = async (url, init) => {
    const res = await real(url, init);
    const body = await res.clone().text();
    const host = new URL(url).host.replace(/[^a-z0-9.]/gi, '_');
    counter[host] = (counter[host] || 0) + 1;
    const dir = path.join(__dirname, '..', 'tests', 'fixtures', 'live', host);
    fs.mkdirSync(dir, { recursive: true });
    const ext = /json/.test(res.headers.get('content-type') || '') ? 'json' : 'html';
    fs.writeFileSync(path.join(dir, `${String(counter[host]).padStart(3, '0')}.${ext}`), body);
    fs.appendFileSync(path.join(dir, 'index.txt'), `${counter[host]}\t${res.status}\t${url}\n`);
    return res;
  };
}

(async () => {
  const unknown = only.filter((o) => !SOURCES.some((s) => s.name === o));
  if (unknown.length) { console.error(`Unknown source(s): ${unknown.join(', ')}. Known: ${SOURCES.map((s) => s.name).join(', ')}`); process.exit(2); }
  const r = await runAll({ only, save: false });
  const rows = r.sources.map((s) => ({
    source: s.source, status: s.status, raw: s.raw, valid: s.valid, expired: s.expired, dup: s.duplicates, rejected: s.rejected, stored: s.stored,
    pages: s.pages ? `${s.pages.fetched}${s.pages.expected != null ? '/' + s.pages.expected : ''}${s.pages.complete ? ' complete' : s.pages.capped ? ' CAPPED' : ''}` : '',
    note: (s.error || s.skippedReason || Object.entries(s.rejectReasons || {}).map(([k, v]) => `${k}:${v}`).join(' ')).slice(0, 70),
  }));
  console.table(rows);
  console.log(`Total distinct open listings: ${r.totals.stored} (cross-source duplicates merged: ${r.totals.duplicates})`);
})().catch((e) => { console.error(e); process.exit(1); });

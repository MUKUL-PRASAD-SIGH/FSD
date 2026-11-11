// Ingestion pipeline: parsing, validation, dedupe, pagination, retries, adapters (stubbed fetch) and the runner.
process.env.INGEST_MIN_GAP_MS = '0';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseDate, parseDateRange, parsePrize, jsonLdEvents } = require('../services/ingest/parse');
const { validate } = require('../services/ingest/validate');
const { dedupe, canonicalUrl, titleKey } = require('../services/ingest/dedupe');
const http = require('../services/ingest/http');
const F = require('./fixtures/sources');

http._opts.baseBackoffMs = 1;
const NOW = new Date();
const DAY = 86400000;

// Routes globalThis.fetch to a handler for the duration of fn
async function withFetch(handler, fn) {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    const r = await handler(String(url), init);
    if (r instanceof Response) return r;
    return new Response(typeof r === 'string' ? r : JSON.stringify(r), { status: 200, headers: { 'content-type': typeof r === 'string' ? 'text/html' : 'application/json' } });
  };
  try { return await fn(calls); } finally { globalThis.fetch = real; }
}

// ---------------------------------------------------------------- dates
test('parseDate: epochs, offsets, naive times in the source timezone, month names', () => {
  assert.equal(parseDate(1767225600).toISOString(), '2026-01-01T00:00:00.000Z');
  assert.equal(parseDate(1767225600000).toISOString(), '2026-01-01T00:00:00.000Z');
  assert.equal(parseDate('1767225600').toISOString(), '2026-01-01T00:00:00.000Z');
  assert.equal(parseDate('2026-11-15T23:59:00+05:30').toISOString(), '2026-11-15T18:29:00.000Z');
  assert.equal(parseDate('2026-11-07 21:00:00+0900').toISOString(), '2026-11-07T12:00:00.000Z');
  assert.equal(parseDate('2026-11-15 23:59', { tz: 'Asia/Kolkata' }).toISOString(), '2026-11-15T18:29:00.000Z');
  assert.equal(parseDate('2026-07-01T12:00:00', { tz: 'America/New_York' }).toISOString(), '2026-07-01T16:00:00.000Z'); // EDT
  assert.equal(parseDate('2026-12-01T12:00:00', { tz: 'America/New_York' }).toISOString(), '2026-12-01T17:00:00.000Z'); // EST
  assert.equal(parseDate('Nov 12, 2026', { endOfDay: true }).toISOString(), '2026-11-12T23:59:59.000Z');
  assert.equal(parseDate('12 November 2026').toISOString(), '2026-11-12T00:00:00.000Z');
  for (const bad of [null, '', 'soon', 'TBA', -5, 0, '31/31/2026']) assert.equal(parseDate(bad), null, String(bad));
});

test('parseDateRange: every Devpost form, including the short and cross-year ones the old parser dropped', () => {
  const r = (s) => { const x = parseDateRange(s); return [x.start?.toISOString().slice(0, 10), x.end?.toISOString()]; };
  assert.deepEqual(r('Oct 01 - Nov 12, 2026'), ['2026-10-01', '2026-11-12T23:59:59.000Z']);
  assert.deepEqual(r('Nov 03 - 15, 2026'), ['2026-11-03', '2026-11-15T23:59:59.000Z']);
  assert.deepEqual(r('Dec 28, 2026 - Jan 03, 2027'), ['2026-12-28', '2027-01-03T23:59:59.000Z']);
  assert.deepEqual(r('Dec 28 - Jan 03, 2027'), ['2026-12-28', '2027-01-03T23:59:59.000Z']);
  assert.deepEqual(r('Oct 1 – Nov 12, 2026'), ['2026-10-01', '2026-11-12T23:59:59.000Z']);
  assert.deepEqual(r('Nov 12, 2026'), ['2026-11-12', '2026-11-12T23:59:59.000Z']);
  assert.deepEqual(r('Sep 01, 2026 - Nov 30, 2026'), ['2026-09-01', '2026-11-30T23:59:59.000Z']);
  assert.equal(parseDateRange('rolling').end, null);
  // Devpost is Eastern time: end of day in New York
  assert.equal(parseDateRange('Nov 03 - 15, 2026', { tz: 'America/New_York' }).end.toISOString(), '2026-11-16T04:59:59.000Z');
});

// ---------------------------------------------------------------- money
test('parsePrize: symbols, codes, Indian and western units, largest amount wins, bare numbers ignored', () => {
  const p = (s, c) => { const x = parsePrize(s, c); return x && [x.amount, x.currency, x.label]; };
  assert.deepEqual(p('$10,000 in prizes'), [10000, 'USD', '$10,000']);
  assert.deepEqual(p('$<span data-currency-value>50,000</span>'), [50000, 'USD', '$50,000']);
  assert.deepEqual(p('₹1,00,000'), [100000, 'INR', '₹1 L']);
  assert.deepEqual(p('Rs. 50000'), [50000, 'INR', '₹50,000']);
  assert.deepEqual(p('INR 5 Lakhs'), [500000, 'INR', '₹5 L']);
  assert.deepEqual(p('Prize pool 1.5 Cr'), [15000000, 'INR', '₹1.5 Cr']);
  assert.deepEqual(p('$5K'), [5000, 'USD', '$5,000']);
  assert.deepEqual(p('€2,000'), [2000, 'EUR', '€2,000']);
  assert.deepEqual(p('50k USDC'), [50000, 'USDC', '50,000 USDC']);
  assert.deepEqual(p('10000 USD'), [10000, 'USD', '$10,000']);
  assert.deepEqual(p('1st: $500, 2nd: $3,000'), [3000, 'USD', '$3,000']);
  assert.deepEqual(p(75000, 'INR'), [75000, 'INR', '₹75,000']);
  assert.equal(parsePrize('Top 3 teams win swag'), null);
  assert.equal(parsePrize('Knowledge'), null);
  assert.equal(parsePrize(''), null);
  assert.equal(parsePrize('$1,000').inr, 84000);
});

// ---------------------------------------------------------------- validation
test('validate: documented reject reasons, expired separated, optional fields never cause a rejection', () => {
  const base = { externalId: 'x', title: 'Good Hack', url: 'https://x.example.org', deadline: new Date(NOW.getTime() + 5 * DAY) };
  assert.equal(validate(base).status, 'valid');
  assert.equal(validate({ ...base, title: '  ' }).reason, 'missing_title');
  assert.equal(validate({ ...base, url: 'javascript:alert(1)' }).reason, 'invalid_url');
  assert.equal(validate({ ...base, url: '' }).reason, 'invalid_url');
  assert.equal(validate({ ...base, deadline: null }).reason, 'missing_date');
  assert.equal(validate({ ...base, deadline: 'TBA' }).reason, 'unparseable_date');
  assert.equal(validate({ ...base, deadline: new Date(NOW.getTime() + 900 * DAY) }).reason, 'implausible_date');
  assert.equal(validate({ ...base, deadline: new Date(NOW.getTime() - DAY) }).status, 'expired');

  // Minimal record: no prize, city, skills, eligibility, mode -> still stored, with neutral defaults
  const v = validate({ title: 'Bare', url: 'https://bare.example.org', deadline: new Date(NOW.getTime() + DAY) });
  assert.equal(v.status, 'valid');
  assert.equal(v.item.prizeLabel, 'See listing');
  assert.equal(v.item.prizeInr, null);
  assert.equal(v.item.mode, 'ONLINE');
  assert.ok(v.item.inferred.includes('mode assumed online'));
  assert.equal(v.item.externalId, 'https://bare.example.org/');

  // No deadline -> start date (contests), then end date
  const c = validate({ title: 'Round', url: 'https://cf.example.org', startDate: Math.floor((NOW.getTime() + 2 * DAY) / 1000), endDate: Math.floor((NOW.getTime() + 3 * DAY) / 1000) });
  assert.equal(c.item.deadlineKind, 'event_start');
  assert.ok(Math.abs(c.item.deadline - (NOW.getTime() + 2 * DAY)) < 2000);
  const s = validate({ ...base, deadline: undefined, deadlineKind: 'submission', startDate: new Date(NOW.getTime() - DAY), endDate: new Date(NOW.getTime() + DAY) });
  assert.equal(s.status, 'expired', 'an event that already started with no stated deadline is treated as closed');
  assert.equal(validate({ ...base, deadlineKind: 'submission' }).item.deadlineKind, 'submission');
  // Unknown type/mode are normalised, skills derived from text
  const n = validate({ ...base, type: 'weird', mode: 'teleport', title: 'React and PyTorch Hack' });
  assert.equal(n.item.type, 'COMPETITION');
  assert.equal(n.item.mode, 'ONLINE');
  assert.ok(n.item.skills.includes('React') && n.item.skills.includes('PyTorch'));
});

// ---------------------------------------------------------------- dedupe
test('dedupe: same event across sources merges with attribution; same-feed lookalikes do not; native beats aggregator', () => {
  const d = (n) => new Date(NOW.getTime() + n * DAY);
  const item = (o) => ({ externalId: o.id, title: o.title, url: o.url, deadline: o.deadline || d(5), startDate: o.startDate, eligibility: [], tags: [], skills: [], prizeLabel: 'See listing', ...o.extra });
  const { kept, duplicates } = dedupe([
    { source: 'unstop', item: item({ id: 'u1', title: 'HackMIT 2026', url: 'https://unstop.com/h/hackmit', startDate: d(7), extra: { prizeInr: 100000, prizeLabel: '₹1 L' } }) },
    { source: 'devfolio', item: item({ id: 'f1', title: 'HackMIT', url: 'https://hackmit.devfolio.co/', startDate: d(8), extra: { organiser: 'MIT', eligibility: ['University students'] } }) },
    { source: 'clist', item: item({ id: 'c1', title: 'Codeforces Round 1000 (Div. 2)', url: 'https://codeforces.com/contests/2000?utm_source=clist', startDate: d(2) }) },
    { source: 'codeforces', item: item({ id: '2000', title: 'Codeforces Round 1000 (Div. 2)', url: 'https://codeforces.com/contests/2000', startDate: d(2) }) },
    { source: 'unstop', item: item({ id: 'q1', title: 'Weekly Quiz', url: 'https://unstop.com/q/1' }) },
    { source: 'unstop', item: item({ id: 'q2', title: 'Weekly Quiz', url: 'https://unstop.com/q/2' }) },
    { source: 'devpost', item: item({ id: 'p1', title: 'HackMIT', url: 'https://hackmit.devpost.com', startDate: d(200) }) }, // same name, different edition
  ]);
  const titles = kept.map((k) => `${k.source}:${k.item.title}`).sort();
  assert.deepEqual(titles, ['codeforces:Codeforces Round 1000 (Div. 2)', 'devfolio:HackMIT', 'devpost:HackMIT', 'unstop:Weekly Quiz', 'unstop:Weekly Quiz'].sort());
  assert.equal(duplicates.length, 2);
  const hm = kept.find((k) => k.source === 'devfolio').item;
  assert.deepEqual(hm.alsoOn.map((a) => a.source), ['unstop']);
  assert.equal(hm.prizeInr, 100000, 'gaps in the primary are filled from the duplicate');
  assert.equal(kept.find((k) => k.source === 'codeforces').item.alsoOn[0].source, 'clist');
  assert.equal(canonicalUrl('https://www.Example.org/a/?utm_source=x&id=2#f'), 'example.org/a?id=2');
  assert.equal(titleKey("HackMIT '26 — The Official Edition"), 'hackmit');
});

// ---------------------------------------------------------------- http + pagination
test('http: retries 429/5xx with backoff and Retry-After, does not retry 4xx, rejects non-JSON', async () => {
  let n = 0;
  await withFetch(() => (++n < 3 ? new Response('busy', { status: n === 1 ? 429 : 503, headers: { 'retry-after': '0' } }) : { ok: 1 }), async () => {
    assert.deepEqual(await http.getJson('https://a.example.org/x'), { ok: 1 });
  });
  assert.equal(n, 3);
  n = 0;
  await withFetch(() => { n++; return new Response('nope', { status: 404 }); }, async () => {
    await assert.rejects(http.getJson('https://b.example.org/x'), /responded 404/);
  });
  assert.equal(n, 1);
  n = 0;
  await withFetch(() => { n++; throw new TypeError('fetch failed'); }, async () => {
    await assert.rejects(http.getJson('https://c.example.org/x'), /network error|fetch failed/);
  });
  assert.equal(n, http._opts.retries + 1);
  await withFetch(() => '<html>not json</html>', async () => {
    await assert.rejects(http.getJson('https://d.example.org/x'), /not JSON/);
  });
});

test('paginate: follows totalPages, stops on empty pages, flags caps and keeps partial results on failure', async () => {
  let t = http.pageTracker();
  let out = await http.paginate(t, {}, async (p) => ({ items: [p], totalPages: 4 }));
  assert.deepEqual(out, [1, 2, 3, 4]);
  assert.deepEqual(t.snapshot(), { fetched: 4, expected: 4, complete: true, capped: false });

  t = http.pageTracker();
  out = await http.paginate(t, {}, async (p) => ({ items: p < 3 ? [p] : [] }));
  assert.deepEqual(out, [1, 2]);
  assert.equal(t.snapshot().complete, true);

  t = http.pageTracker();
  out = await http.paginate(t, { maxPages: 2 }, async (p) => ({ items: [p], totalPages: 10 }));
  assert.deepEqual(out, [1, 2]);
  assert.equal(t.snapshot().complete, false);
  assert.equal(t.snapshot().capped, true);

  t = http.pageTracker();
  await assert.rejects(http.paginate(t, {}, async (p) => { if (p === 3) throw new Error('boom'); return { items: [p], totalPages: 5 }; }), (e) => {
    assert.deepEqual(e.partial, [1, 2]);
    return true;
  });

  t = http.pageTracker();
  out = await http.paginate(t, { start: 0 }, async (p) => ({ items: [p], totalPages: 3 }));
  assert.deepEqual(out, [0, 1, 2], 'zero-based offsets');
});

// ---------------------------------------------------------------- adapters
test('devpost adapter reads every page and parses all date forms', async () => {
  const pages = F.devpostPages(NOW);
  const devpost = require('../services/ingest/sources/devpost');
  await withFetch((url) => {
    assert.match(url, /status\[\]=open&status\[\]=upcoming/);
    return pages[Number(new URL(url).searchParams.get('page')) - 1] || { hackathons: [], meta: pages[0].meta };
  }, async (calls) => {
    const tracker = http.pageTracker();
    const rows = await devpost.fetchListings({ pages: tracker });
    assert.equal(calls.length, 3);
    assert.equal(rows.length, 25);
    assert.equal(tracker.snapshot().complete, true);
    const results = rows.map((r) => validate(r, { now: NOW }));
    assert.equal(results.filter((r) => r.status === 'valid').length, 22, 'all good records survive, including the short date range');
    assert.deepEqual(results.filter((r) => r.status === 'rejected').map((r) => r.reason).sort(), ['invalid_url', 'unparseable_date']);
    assert.equal(results.filter((r) => r.status === 'expired').length, 1);
    const first = results[0].item;
    assert.equal(first.prizeLabel, '$1,000');
    assert.equal(first.prizeCurrency, 'USD');
    assert.equal(first.deadlineKind, 'submission');
    assert.equal(results[2].item.city, 'Bengaluru');
  });
});

test('unstop adapter paginates each category to last_page and keeps IST offsets', async () => {
  const unstop = require('../services/ingest/sources/unstop');
  await withFetch((url) => {
    const u = new URL(url);
    const kind = u.searchParams.get('opportunity');
    const last = { hackathons: 2, competitions: 3, quizzes: 1 }[kind];
    return F.unstopPage(kind, Number(u.searchParams.get('page')), last, NOW);
  }, async (calls) => {
    const tracker = http.pageTracker();
    const rows = await unstop.fetchListings({ pages: tracker });
    assert.equal(calls.length, 6);
    assert.equal(rows.length, 18);
    assert.deepEqual(tracker.snapshot(), { fetched: 6, expected: 6, complete: true, capped: false });
    const v = rows.map((r) => validate(r, { now: NOW })).filter((r) => r.status === 'valid').map((r) => r.item);
    assert.equal(v.length, 18);
    assert.equal(v.find((x) => /Case Study/.test(x.title)).type, 'CASE STUDY');
    assert.equal(v[0].prizeInr, 75000);
    assert.equal(v[0].teamMax, 4);
    assert.equal(v.find((x) => x.city === 'Pune').mode, 'OFFLINE');
  });
});

test('HTML/embedded-data adapters: MLH microdata, AtCoder table, ETHGlobal Next.js data, JSON-LD fallback', () => {
  const mlh = require('../services/ingest/sources/mlh').parseHtml(F.mlhHtml(NOW));
  assert.equal(mlh.length, 2);
  assert.equal(mlh[0].title, 'HackFoo');
  assert.equal(mlh[0].mode, 'OFFLINE');
  assert.equal(mlh[0].city, 'Boston');
  assert.equal(mlh[1].mode, 'ONLINE');
  assert.equal(validate(mlh[0], { now: NOW }).item.deadlineKind, 'event_start');

  const at = require('../services/ingest/sources/atcoder').parseHtml(F.atcoderHtml(NOW));
  assert.equal(at.length, 1);
  assert.equal(at[0].url, 'https://atcoder.jp/contests/abc999');
  const atv = validate(at[0], { now: NOW });
  assert.equal(atv.status, 'valid');
  assert.ok(Math.abs(atv.item.deadline - (NOW.getTime() + 3 * DAY)) < 2000, 'the +0900 offset is honoured');

  const eth = require('../services/ingest/sources/ethglobal').parseHtml(F.ethglobalHtml(NOW));
  assert.deepEqual(eth.map((e) => e.title), ['ETHGlobal Bangkok', 'ETHGlobal Online'], 'summits are skipped');
  assert.equal(eth[0].url, 'https://ethglobal.com/events/bangkok');
  assert.equal(eth[1].mode, 'ONLINE');

  const ld = jsonLdEvents(`<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Hackathon"},{"@type":"Event","name":"LD Hack","startDate":"2030-01-01"}]}</script>`);
  assert.equal(ld.length, 1);
  assert.equal(ld[0].name, 'LD Hack');
});

test('hackclub adapter marks events as high-school only; key-gated adapters report skipped without keys', async () => {
  const hc = require('../services/ingest/sources/hackclub');
  await withFetch(() => F.hackclub(NOW), async () => {
    const rows = await hc.fetchListings({});
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0].eligibility, ['High school students']);
    assert.equal(rows[1].mode, 'ONLINE');
  });
  delete process.env.KAGGLE_KEY; delete process.env.CLIST_API_KEY;
  assert.equal(require('../services/ingest/sources/kaggle').enabled().ok, false);
  assert.equal(require('../services/ingest/sources/clist').enabled().ok, false);
});

// ---------------------------------------------------------------- runner (no database)
test('runner isolates failures and reports per-source counts', async () => {
  const { runAll } = require('../services/ingest/run');
  const future = new Date(NOW.getTime() + 4 * DAY);
  const ok = { name: 'okSrc', fetchListings: async ({ pages }) => { pages.page(); pages.done(); return [
    { externalId: 1, title: 'A', url: 'https://a.example.org', deadline: future },
    { externalId: 1, title: 'A again', url: 'https://a.example.org', deadline: future },
    { externalId: 2, title: 'Old', url: 'https://o.example.org', deadline: new Date(NOW.getTime() - DAY) },
    { externalId: 3, title: '', url: 'https://x.example.org', deadline: future },
  ]; } };
  const boom = { name: 'boomSrc', fetchListings: async () => { throw new Error('site down'); } };
  const half = { name: 'halfSrc', fetchListings: async () => { const e = new Error('page 3 timed out'); e.partial = [{ externalId: 9, title: 'B', url: 'https://b.example.org', deadline: future }]; throw e; } };
  const off = { name: 'offSrc', enabled: () => ({ ok: false, reason: 'needs KEY' }), fetchListings: async () => { throw new Error('should not run'); } };
  const r = await runAll({ adapters: [ok, boom, half, off], only: [], save: false, now: NOW });
  const by = Object.fromEntries(r.sources.map((s) => [s.source, s]));
  assert.equal(by.okSrc.status, 'ok');
  assert.deepEqual([by.okSrc.raw, by.okSrc.valid, by.okSrc.duplicates, by.okSrc.expired, by.okSrc.rejected, by.okSrc.stored], [4, 1, 1, 1, 1, 1]);
  assert.equal(by.okSrc.rejectReasons.missing_title, 1);
  assert.equal(by.boomSrc.status, 'failed');
  assert.equal(by.boomSrc.error, 'site down');
  assert.equal(by.halfSrc.status, 'partial');
  assert.equal(by.halfSrc.stored, 1, 'records fetched before the failure are kept');
  assert.equal(by.offSrc.status, 'skipped');
  assert.equal(r.totals.stored, 2);
});

test('ethglobal: the live card layout (no embedded JSON) is parsed, with year taken from the slug or end date', () => {
  const html = `<html><body>
    <a href="/events/cannes2027"><section><div><div class="uppercase">April</div><div><span>14</span><svg/><span>16</span></div></div><h2>ETHGlobal Cannes 2027</h2><div>Cannes, FranceIRL HackathonApply to Attend</div></section></a>
    <a href="/events/pragma-cannes2027"><section><div class="uppercase">April</div><span>13</span><h2>Pragma Cannes 2027</h2></section></a>
    <a href="/events/ethonline2026"><h2>ETHOnline 2026</h2><time>Sep 4th</time><time>Sep 16th, 2026</time><time>Sep 4th</time><time>Sep 16th, 2026</time><div>Online</div></a></body></html>`;
  const eth = require('../services/ingest/sources/ethglobal').parseHtml(html);
  assert.deepEqual(eth.map((e) => e.title), ['ETHGlobal Cannes 2027', 'ETHOnline 2026'], 'Pragma side events are skipped');
  assert.equal(eth[0].endDate.slice(0, 10), '2027-04-16');
  assert.equal(eth[1].startDate.slice(0, 10), '2026-09-04');
  assert.equal(eth[1].mode, 'ONLINE');
});

test('dorahacks is skipped (not failed) while its bot wall blocks automated access', async () => {
  delete process.env.DORAHACKS_API_URL;
  const d = require('../services/ingest/sources/dorahacks');
  const g = d.enabled();
  assert.equal(g.ok, false);
  assert.match(g.reason, /bot verification/);
});

test('HTML entities in platform text are decoded (named, decimal, hex) in every stored text field', () => {
  const { decodeEntities } = require('../services/ingest/parse');
  assert.equal(decodeEntities('BuildLab 2026 &mdash; Pro &amp; Co &#8217;s &#x2014; &nbsp;ok'), 'BuildLab 2026 — Pro & Co ’s —  ok');
  assert.equal(decodeEntities('&unknownentity; stays'), '&unknownentity; stays');
  const v = validate({ title: 'Hack &amp; Build &mdash; 2026', description: 'Fun &mdash; time', city: 'Science &amp; Technology Building', url: 'https://x.example/e', deadline: new Date(NOW.getTime() + 3 * DAY) }, { now: NOW });
  assert.equal(v.status, 'valid');
  assert.deepEqual([v.item.title, v.item.description, v.item.city], ['Hack & Build — 2026', 'Fun — time', 'Science & Technology Building']);
});

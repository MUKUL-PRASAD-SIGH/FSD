// clist.by aggregator (official API v4): upcoming contests from 200+ judges and competition sites (AtCoder,
// TopCoder, HackerRank, Kaggle, Kick Start-style events, university contests ...). Requires a free API key:
// clist.by -> sign in -> https://clist.by/api/v4/doc/ shows "ApiKey <username>:<key>". Set CLIST_USERNAME and
// CLIST_API_KEY. Sites we already ingest natively are de-duplicated against this feed (native wins).
const { getJson, paginate } = require('../http');

const API = 'https://clist.by/api/v4/contest/';
const enabled = () => (process.env.CLIST_USERNAME && process.env.CLIST_API_KEY ? { ok: true } : { ok: false, reason: 'needs CLIST_USERNAME and CLIST_API_KEY' });
const NATIVE = new Set(['codeforces.com', 'codechef.com', 'leetcode.com', 'atcoder.jp']);
const hostOf = (c) => String(c.host || c.resource || '').replace(/^www\./, '');

function map(c) {
  const host = hostOf(c);
  const kaggle = /kaggle/.test(host);
  return {
    externalId: c.id,
    title: c.event,
    organiser: host,
    type: kaggle ? 'COMPETITION' : 'CODING',
    platform: host,
    url: c.href,
    tz: 'UTC', // clist returns naive UTC timestamps
    startDate: c.start,
    endDate: c.end,
    mode: 'ONLINE',
    tags: ['Algorithms', host],
    skills: kaggle ? ['Machine Learning'] : ['DSA'],
    description: c.duration ? `${Math.round(c.duration / 60)} minute contest on ${host}.` : `Contest on ${host}.`,
  };
}

async function fetchListings({ pages, now = new Date() } = {}) {
  const auth = `ApiKey ${process.env.CLIST_USERNAME}:${process.env.CLIST_API_KEY}`;
  const limit = 500;
  const skipNative = process.env.CLIST_INCLUDE_NATIVE !== 'true';
  const startGt = now.toISOString().slice(0, 19);
  const rows = await paginate(pages, { start: 0, maxPages: 20 }, async (i) => {
    const j = await getJson(`${API}?format=json&upcoming=true&start__gt=${startGt}&order_by=start&limit=${limit}&offset=${i * limit}`, { headers: { Authorization: auth } });
    const total = j.meta?.total_count;
    return { items: j.objects || [], totalPages: Number.isFinite(total) ? Math.ceil(total / limit) : undefined, hasMore: j.meta ? !!j.meta.next : undefined };
  });
  return rows.filter((c) => !(skipNative && NATIVE.has(hostOf(c)))).map(map);
}

module.exports = { name: 'clist', label: 'clist.by (aggregator)', enabled, fetchListings, map };

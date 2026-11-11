// DoraHacks hackathons (BUIDL platform). Uses the JSON API behind dorahacks.io/hackathon, DRF-style pagination
// ({ count, next, results }). Prizes are usually in USD or stablecoins. Ongoing hackathons accept BUIDLs until
// the end time, so the end time is the deadline.
const { getJson, paginate } = require('../http');
const { genericEvent } = require('../generic');

// dorahacks.io answers automated requests with a "Human Verification" bot wall (HTTP 405/404 to the API), checked 11 Nov 2026.
// We do not bypass bot protection, so the adapter is skipped unless an endpoint you are authorised to use is configured.
const API = process.env.DORAHACKS_API_URL || 'https://dorahacks.io/api/hackathon/';
const enabled = () => (process.env.DORAHACKS_API_URL ? { ok: true } : { ok: false, reason: 'dorahacks.io blocks automated access (bot verification); set DORAHACKS_API_URL to an authorised endpoint to enable' });
const STATUSES = ['ongoing', 'upcoming'];

function map(h) {
  const g = genericEvent(h, { platform: 'DoraHacks', urlFor: (slug) => `https://dorahacks.io/hackathon/${slug}`, defaultCurrency: 'USD' });
  const end = h.end_time ?? h.endTime ?? h.end;
  return { ...g, deadline: g.deadline || end || null, deadlineKind: g.deadline ? 'registration' : 'submission', tags: [...(g.tags || []), 'Web3'] };
}

async function fetchListings({ pages } = {}) {
  const out = [];
  for (const status of STATUSES) {
    const rows = await paginate(pages, { maxPages: 40 }, async (page) => {
      const j = await getJson(`${API}?page=${page}&page_size=50&status=${status}`);
      const items = j.results || j.data?.results || j.data || [];
      const total = j.count ?? j.data?.count;
      return { items: Array.isArray(items) ? items : [], hasMore: j.next != null ? !!j.next : undefined, totalPages: Number.isFinite(total) ? Math.ceil(total / 50) : undefined };
    }).catch((e) => { e.partial = [...out, ...(e.partial || []).map(map)]; throw e; });
    out.push(...rows.map(map));
  }
  return out;
}

module.exports = { name: 'dorahacks', label: 'DoraHacks', enabled, fetchListings, map };

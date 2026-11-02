// Devpost: the public JSON endpoint its own /hackathons page calls.
// Pagination: meta.total_count / meta.per_page (falls back to "stop on an empty page").
// Dates: `submission_period_dates` is a human range ("Oct 01 - Nov 12, 2026", "Nov 03 - 15, 2026",
// "Dec 28, 2026 - Jan 03, 2027"). The previous parser only understood the first form and silently dropped the rest.
const { getJson, paginate } = require('../http');
const { parseDateRange, parsePrize } = require('../parse');

const BASE = process.env.DEVPOST_API_URL || 'https://devpost.com/api/hackathons';
const TZ = 'America/New_York'; // Devpost shows deadlines in Eastern time

function map(h) {
  const loc = h.displayed_location?.location || '';
  const online = /online|virtual/i.test(loc) || h.displayed_location?.icon === 'globe';
  const { start, end } = parseDateRange(h.submission_period_dates, { tz: TZ });
  const prize = parsePrize(h.prize_amount, 'USD');
  const parts = loc.split(',').map((x) => x.trim()).filter(Boolean);
  return {
    externalId: h.id,
    title: h.title,
    organiser: h.organization_name || '',
    type: 'HACKATHON',
    platform: 'Devpost',
    url: h.url,
    deadline: end || h.submission_period_dates || null, // unparseable text is kept so validation reports it as such
    deadlineKind: 'submission',
    startDate: start,
    mode: online ? 'ONLINE' : 'OFFLINE',
    city: online ? '' : parts[0] || '',
    country: online ? '' : parts.length > 1 ? parts[parts.length - 1] : '',
    prizeLabel: prize?.label, prizeInr: prize?.inr, prizeAmount: prize?.amount, prizeCurrency: prize?.currency,
    eligibility: [h.invite_only ? 'Invite only' : '', h.eligibility_requirement_invite_only_description || ''].filter(Boolean),
    tags: (h.themes || []).map((t) => t.name),
    registered: h.registrations_count ?? null,
    description: h.open_state === 'upcoming' ? 'Upcoming: submissions open soon.' : '',
  };
}

async function fetchListings({ pages } = {}) {
  const rows = await paginate(pages, { maxPages: Number(process.env.DEVPOST_MAX_PAGES || 120) }, async (page) => {
    const data = await getJson(`${BASE}?status[]=open&status[]=upcoming&order_by=deadline&page=${page}`);
    const items = data.hackathons || [];
    const total = data.meta?.total_count;
    const per = data.meta?.per_page || items.length || 9;
    return { items, totalPages: Number.isFinite(total) ? Math.max(1, Math.ceil(total / per)) : undefined };
  });
  return rows.map(map);
}

module.exports = { name: 'devpost', label: 'Devpost', fetchListings, map };

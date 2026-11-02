// Devpost's public JSON endpoint (the one its own site uses).
const { getJson, stripHtml, rupees, usdToInr } = require('../common');

function parsePrize(html) {
  const text = stripHtml(html);
  const n = Number((text.match(/[\d,]+/) || [''])[0].replace(/,/g, ''));
  if (!n) return { label: 'See listing', inr: null };
  const inr = text.includes('$') ? usdToInr(n) : n;
  return { label: text.includes('$') ? `$${n.toLocaleString('en-US')}` : rupees(n), inr };
}

// "Oct 01 - Nov 12, 2026" -> end of the last day
function parseEnd(range) {
  const m = (range || '').match(/([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})\s*$/);
  if (!m) return null;
  const d = new Date(`${m[1]} ${m[2]}, ${m[3]} 23:59:59`);
  return isNaN(d) ? null : d;
}

async function fetchListings({ pages = 4 } = {}) {
  const out = [];
  for (let page = 1; page <= pages; page++) {
    const data = await getJson(`https://devpost.com/api/hackathons?status[]=open&order_by=deadline&page=${page}`);
    for (const h of data.hackathons || []) {
      const loc = h.displayed_location?.location || '';
      const online = /online/i.test(loc);
      const prize = parsePrize(h.prize_amount);
      out.push({
        externalId: h.id, title: h.title, organiser: h.organization_name, type: 'HACKATHON', platform: 'Devpost',
        url: h.url, deadline: parseEnd(h.submission_period_dates), mode: online ? 'ONLINE' : 'OFFLINE', city: online ? '' : loc,
        prizeLabel: prize.label, prizeInr: prize.inr, tags: (h.themes || []).map((t) => t.name), registered: h.registrations_count ?? null,
      });
    }
    if (page >= (data.meta?.total_pages || 1)) break;
  }
  return out;
}

module.exports = { name: 'devpost', fetchListings };

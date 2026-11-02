// Live ingestion from Devpost's public JSON endpoint (the same one its website uses).
// Only public listing metadata is stored; each listing links back to the organiser.
const Listing = require('../../models/Listing');

const USD_TO_INR = Number(process.env.USD_TO_INR || 84);

const stripTags = (s) => (s || '').replace(/<[^>]*>/g, '');
const parsePrize = (html) => {
  const text = stripTags(html);
  const n = Number((text.match(/[\d,]+/) || [''])[0].replace(/,/g, ''));
  if (!n) return { label: 'See listing', inr: null };
  const usd = text.includes('$');
  return { label: text.trim(), inr: usd ? Math.round(n * USD_TO_INR) : n };
};

// "Oct 01 - Nov 12, 2026" -> Date of the end day
function parseEnd(range) {
  const m = (range || '').match(/-\s*([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})\s*$/) || (range || '').match(/([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})\s*$/);
  if (!m) return null;
  const d = new Date(`${m[1]} ${m[2]}, ${m[3]} 23:59:59`);
  return isNaN(d) ? null : d;
}

async function fetchPage(page) {
  const url = `https://devpost.com/api/hackathons?status[]=open&order_by=deadline&page=${page}`;
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'HackEliteBot/2.0 (student project)' } });
  if (!res.ok) throw new Error(`Devpost responded ${res.status}`);
  return res.json();
}

async function ingestDevpost({ pages = 3 } = {}) {
  let upserts = 0;
  for (let page = 1; page <= pages; page++) {
    const data = await fetchPage(page);
    const items = data.hackathons || [];
    if (!items.length) break;
    for (const h of items) {
      const deadline = parseEnd(h.submission_period_dates);
      if (!deadline || deadline < new Date()) continue;
      const loc = h.displayed_location?.location || '';
      const online = /online/i.test(loc);
      const prize = parsePrize(h.prize_amount);
      const themes = (h.themes || []).map((t) => t.name);
      await Listing.updateOne(
        { source: 'devpost', externalId: String(h.id) },
        {
          $set: {
            title: h.title,
            organiser: h.organization_name || '',
            type: 'HACKATHON',
            platform: 'Devpost',
            url: h.url,
            deadline,
            mode: online ? 'ONLINE' : 'OFFLINE',
            city: online ? '' : loc,
            prizeLabel: prize.label,
            prizeInr: prize.inr,
            fee: 'Free',
            tags: themes,
            registered: h.registrations_count ?? null,
            refreshedAt: new Date(),
          },
          $setOnInsert: { description: '', skills: [] },
        },
        { upsert: true }
      );
      upserts++;
    }
    if (page >= (data.meta?.total_pages || 1)) break;
  }
  return upserts;
}

module.exports = { ingestDevpost };

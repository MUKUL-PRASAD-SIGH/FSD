// Devfolio public hackathon listing. Two passes: applications open now, and upcoming (opening soon).
// Pagination: `pages` in the response (falls back to "stop on an empty page").
const { getJson, paginate } = require('../http');
const { stripHtml, parsePrize } = require('../parse');

const FILTERS = (process.env.DEVFOLIO_FILTERS || 'application_open,upcoming').split(',').map((s) => s.trim()).filter(Boolean);

function map(h) {
  const s = h.hackathon_setting || {};
  const sub = s.subdomain || h.slug;
  const prize = parsePrize(h.prize_amount ?? h.prizes_total ?? (Array.isArray(h.prizes) ? h.prizes.map((p) => p.amount || p.name || '').join(' ') : ''), 'INR');
  return {
    externalId: h.uuid || h.slug,
    title: h.name,
    organiser: h.organization_name || (h.location || '').split(',')[0].trim(),
    type: 'HACKATHON',
    platform: 'Devfolio',
    url: s.site || (sub ? `https://${sub}.devfolio.co/` : null),
    tz: 'Asia/Kolkata',
    deadline: s.reg_ends_at || null,
    startDate: h.starts_at || null,
    endDate: h.ends_at || null,
    mode: h.is_online ? 'ONLINE' : 'OFFLINE',
    city: h.is_online ? '' : h.city || '',
    state: h.state || '',
    country: h.country || '',
    prizeLabel: prize?.label, prizeInr: prize?.inr, prizeAmount: prize?.amount, prizeCurrency: prize?.currency,
    eligibility: [h.is_university_hackathon ? 'University students' : '', h.is_private ? 'Invite only' : ''].filter(Boolean),
    teamMin: Number(s.team_min) || undefined,
    teamMax: Number(s.team_size) || undefined,
    tags: (h.themes || []).map((t) => (typeof t === 'string' ? t : t.name)).filter(Boolean),
    description: stripHtml(`${h.tagline || ''} ${h.desc || ''}`),
    registered: h.participants_count || null,
  };
}

async function fetchListings({ pages } = {}) {
  const out = [];
  for (const filter of FILTERS) {
    const rows = await paginate(pages, { maxPages: 80 }, async (page) => {
      const j = await getJson(`https://api.devfolio.co/api/hackathons?filter=${filter}&page=${page}&count=24`);
      return { items: j.result || [], totalPages: j.pages };
    }).catch((e) => { e.partial = [...out, ...(e.partial || []).map(map)]; throw e; });
    out.push(...rows.map(map));
  }
  return out;
}

module.exports = { name: 'devfolio', label: 'Devfolio', fetchListings, map };

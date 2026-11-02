// Unstop public search endpoint: hackathons, competitions (incl. case competitions) and quizzes.
// Pagination: Laravel-style data.last_page. Dates carry +05:30 offsets; bare times are treated as IST.
const { getJson, paginate } = require('../http');
const { stripHtml, parsePrize } = require('../parse');

const BASE = 'https://unstop.com/api/public/opportunity/search-result';
const KINDS = (process.env.UNSTOP_KINDS || 'hackathons,competitions,quizzes').split(',').map((s) => s.trim()).filter(Boolean);

function typeOf(kind, d) {
  if (kind === 'hackathons') return 'HACKATHON';
  if (kind === 'quizzes') return 'QUIZ';
  const t = `${d.title} ${d.subtype || ''}`;
  if (/case[\s_-]*(study|studies|comp)/i.test(t)) return 'CASE STUDY';
  if (/design|ux|ui\b/i.test(t)) return 'DESIGN';
  if (/innovat|ideathon|startup|pitch/i.test(t)) return 'INNOVATION';
  if (/coding|programming|code/i.test(t)) return 'CODING';
  return 'COMPETITION';
}

function map(kind, d) {
  const regn = d.regnRequirements || {};
  const cash = (d.prizes || []).reduce((s, p) => s + (Number(p.cash) || 0), 0);
  const prize = cash ? parsePrize(cash, 'INR') : null;
  const addr = d.address_with_country_logo || {};
  const region = String(d.region || '').toLowerCase();
  const filters = Array.isArray(d.filters) ? d.filters : [];
  return {
    externalId: d.id,
    title: d.title,
    organiser: d.organisation?.name || '',
    type: typeOf(kind, d),
    platform: 'Unstop',
    url: d.seo_url || (d.public_url ? `https://unstop.com/${d.public_url}` : null),
    tz: 'Asia/Kolkata',
    deadline: regn.end_regn_dt || null,
    startDate: d.start_date || null,
    endDate: d.end_date || null,
    mode: region === 'online' ? 'ONLINE' : region === 'hybrid' ? 'HYBRID' : 'OFFLINE',
    city: addr.city || '',
    state: addr.state || '',
    country: addr.country || '',
    prizeLabel: prize?.label, prizeInr: prize?.inr, prizeAmount: prize?.amount, prizeCurrency: prize?.currency,
    fee: d.isPaid ? 'Paid' : 'Free',
    eligibility: filters.map((f) => f.name || f.filter_name || f.title).filter(Boolean).slice(0, 6),
    tags: (d.required_skills || []).map((s) => s.skill_name || s.skill).filter(Boolean),
    teamMin: Number(regn.min_team_size) || undefined,
    teamMax: Number(regn.max_team_size) || undefined,
    description: stripHtml(d.details),
    registered: Number(d.registerCount) || null,
  };
}

async function fetchListings({ pages } = {}) {
  const out = [];
  for (const kind of KINDS) {
    const rows = await paginate(pages, { maxPages: Number(process.env.UNSTOP_MAX_PAGES || 150) }, async (page) => {
      const j = await getJson(`${BASE}?opportunity=${kind}&per_page=40&oppstatus=open&page=${page}`);
      return { items: j.data?.data || [], totalPages: j.data?.last_page };
    }).catch((e) => { e.partial = [...out, ...(e.partial || []).map((d) => map(kind, d))]; throw e; });
    for (const d of rows) if (d.visibility !== 'private' && d.regn_open !== 0) out.push(map(kind, d));
  }
  return out;
}

module.exports = { name: 'unstop', label: 'Unstop', fetchListings, map };

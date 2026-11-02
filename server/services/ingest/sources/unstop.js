// Unstop public search endpoint: hackathons, competitions (incl. case competitions) and quizzes.
const { getJson, stripHtml, rupees } = require('../common');

const BASE = 'https://unstop.com/api/public/opportunity/search-result';
const KINDS = [
  { opportunity: 'hackathons', pages: 4 },
  { opportunity: 'competitions', pages: 5 },
  { opportunity: 'quizzes', pages: 1 },
];

function typeOf(kind, d) {
  if (kind === 'hackathons') return 'HACKATHON';
  if (kind === 'quizzes') return 'QUIZ';
  const t = `${d.title} ${d.subtype}`;
  if (/case[\s_-]*(study|studies|comp)/i.test(t)) return 'CASE STUDY';
  if (/design|ux|ui\b/i.test(t)) return 'DESIGN';
  if (/innovat|ideathon|startup|pitch/i.test(t)) return 'INNOVATION';
  if (/coding|programming|code/i.test(t)) return 'CODING';
  return 'COMPETITION';
}

function map(kind, d) {
  const regn = d.regnRequirements || {};
  const deadline = new Date(regn.end_regn_dt || d.end_date);
  const cash = (d.prizes || []).reduce((s, p) => s + (Number(p.cash) || 0), 0);
  const addr = d.address_with_country_logo || {};
  const region = (d.region || '').toLowerCase();
  const filters = Array.isArray(d.filters) ? d.filters : [];
  return {
    externalId: d.id,
    title: d.title,
    organiser: d.organisation?.name || '',
    type: typeOf(kind, d),
    platform: 'Unstop',
    url: d.seo_url || `https://unstop.com/${d.public_url}`,
    deadline,
    mode: region === 'online' ? 'ONLINE' : region === 'hybrid' ? 'HYBRID' : 'OFFLINE',
    city: addr.city || '',
    prizeLabel: cash ? rupees(cash) : 'See listing',
    prizeInr: cash || null,
    fee: d.isPaid ? 'Paid' : 'Free',
    eligibility: filters.map((f) => f.name || f.filter_name || f.title).filter(Boolean).slice(0, 4),
    tags: (d.required_skills || []).map((s) => s.skill_name || s.skill).filter(Boolean),
    skills: [],
    description: stripHtml(d.details),
    registered: Number(d.registerCount) || null,
  };
}

async function fetchListings() {
  const out = [];
  for (const { opportunity, pages } of KINDS) {
    for (let page = 1; page <= pages; page++) {
      const j = await getJson(`${BASE}?opportunity=${opportunity}&per_page=40&oppstatus=open&page=${page}`);
      for (const d of j.data?.data || []) if (d.visibility === 'public' && d.regn_open !== 0) out.push(map(opportunity, d));
      if (page >= (j.data?.last_page || 1)) break;
    }
  }
  return out;
}

module.exports = { name: 'unstop', fetchListings };

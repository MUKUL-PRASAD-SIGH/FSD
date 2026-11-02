// Topcoder active challenges (public v5 API). Paginated with page/perPage; stops on a short page.
const { getJson, paginate } = require('../http');
const { stripHtml } = require('../parse');

const API = 'https://api.topcoder.com/v5/challenges';
const TYPE = { Development: 'CODING', Design: 'DESIGN', 'Data Science': 'COMPETITION', 'Quality Assurance': 'COMPETITION' };

function map(c) {
  const placement = (c.prizeSets || []).find((p) => /placement/i.test(p.type)) || {};
  const usd = (placement.prizes || []).filter((p) => !p.type || /usd/i.test(p.type)).reduce((s, p) => s + (Number(p.value) || 0), 0);
  const rate = Number(process.env.USD_TO_INR || 84);
  return {
    externalId: c.id,
    title: c.name,
    organiser: 'Topcoder',
    type: TYPE[c.track] || 'COMPETITION',
    platform: 'Topcoder',
    url: `https://www.topcoder.com/challenges/${c.id}`,
    deadline: c.registrationEndDate || c.submissionEndDate,
    deadlineKind: c.registrationEndDate ? 'registration' : 'submission',
    startDate: c.startDate,
    endDate: c.endDate,
    mode: 'ONLINE',
    prizeLabel: usd ? `$${usd.toLocaleString('en-US')}` : undefined, prizeInr: usd ? Math.round(usd * rate) : null, prizeAmount: usd || null, prizeCurrency: usd ? 'USD' : null,
    tags: [c.track, c.type, ...(c.tags || [])].filter(Boolean),
    description: stripHtml(String(c.description || '').replace(/[#*_`>]/g, ' ')).slice(0, 600),
    registered: c.numOfRegistrants || null,
  };
}

async function fetchListings({ pages } = {}) {
  const per = 100;
  const rows = await paginate(pages, { maxPages: 30 }, async (page) => {
    const items = await getJson(`${API}?status=Active&currentPhaseName=Registration&perPage=${per}&page=${page}&sortBy=registrationEndDate&sortOrder=asc`);
    const list = Array.isArray(items) ? items : items.result || [];
    return { items: list, hasMore: list.length >= per };
  });
  return rows.filter((c) => c.type !== 'Task' && c.legacy?.isTask !== true).map(map);
}

module.exports = { name: 'topcoder', label: 'Topcoder', fetchListings, map };

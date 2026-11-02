// Kaggle competitions via the official public API (https://www.kaggle.com/api/v1/competitions/list).
// Requires a free Kaggle API token: Kaggle -> Settings -> API -> "Create New Token" gives KAGGLE_USERNAME / KAGGLE_KEY.
// Without the token the adapter is reported as "skipped" (not failed).
const { getJson, paginate } = require('../http');
const { parsePrize } = require('../parse');

const API = 'https://www.kaggle.com/api/v1/competitions/list';
const enabled = () => (process.env.KAGGLE_USERNAME && process.env.KAGGLE_KEY ? { ok: true } : { ok: false, reason: 'needs KAGGLE_USERNAME and KAGGLE_KEY' });

function map(c) {
  const slug = String(c.ref || c.url || c.id || '').replace(/^https?:\/\/www\.kaggle\.com\/(c|competitions)\//, '');
  const prize = parsePrize(c.reward, 'USD');
  return {
    externalId: c.id ?? slug,
    title: c.title,
    organiser: c.organizationName || 'Kaggle',
    type: 'COMPETITION',
    platform: 'Kaggle',
    url: /^https?:/.test(c.ref || '') ? c.ref : `https://www.kaggle.com/competitions/${slug}`,
    deadline: c.deadline, // final submission deadline, UTC ISO; teams can join until shortly before it
    deadlineKind: 'submission',
    startDate: c.enabledDate,
    mode: 'ONLINE',
    prizeLabel: prize?.label || c.reward || undefined, prizeInr: prize?.inr, prizeAmount: prize?.amount, prizeCurrency: prize?.currency,
    tags: ['Data Science', c.category, ...(c.tags || []).map((t) => t.name || t.ref || t)].filter(Boolean),
    skills: ['Machine Learning', 'Python'],
    description: c.description || '',
    registered: c.teamCount || null,
  };
}

async function fetchListings({ pages } = {}) {
  const auth = 'Basic ' + Buffer.from(`${process.env.KAGGLE_USERNAME}:${process.env.KAGGLE_KEY}`).toString('base64');
  const rows = await paginate(pages, { maxPages: 30 }, async (page) => {
    const j = await getJson(`${API}?page=${page}&sortBy=latestDeadline&category=all`, { headers: { Authorization: auth } });
    const items = Array.isArray(j) ? j : j.competitions || [];
    return { items, hasMore: items.length >= 20 };
  });
  return rows.map(map);
}

module.exports = { name: 'kaggle', label: 'Kaggle', enabled, fetchListings, map };

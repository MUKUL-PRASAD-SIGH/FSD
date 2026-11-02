// GeeksforGeeks practice contests (JSON behind geeksforgeeks.org/events). Times are IST without an offset.
const { getJson, paginate } = require('../http');
const { genericEvent } = require('../generic');
const { findEventArrays } = require('../parse');

const API = process.env.GFG_API_URL || 'https://practiceapi.geeksforgeeks.org/api/vr/events/';

function map(e) {
  const g = genericEvent(e, { platform: 'GeeksforGeeks', organiser: 'GeeksforGeeks', type: 'CODING', tz: 'Asia/Kolkata', urlFor: (slug) => `https://practice.geeksforgeeks.org/contest/${slug}` });
  return { ...g, skills: ['DSA'], tags: ['Algorithms', ...(g.tags || [])] };
}

async function fetchListings({ pages } = {}) {
  const rows = await paginate(pages, { maxPages: 10 }, async (page) => {
    const j = await getJson(`${API}?page_number=${page}&sub_type=all&type=contest`);
    // Upcoming contests are listed separately from past ones; never ingest the archive
    const upcoming = j.results?.upcoming ?? j.upcoming ?? (Array.isArray(j.results) ? j.results : findEventArrays(j).flat());
    return { items: upcoming || [], hasMore: false };
  });
  return rows.map(map);
}

module.exports = { name: 'geeksforgeeks', label: 'GeeksforGeeks', fetchListings, map };

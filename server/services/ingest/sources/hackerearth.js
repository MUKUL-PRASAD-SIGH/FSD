// HackerEarth events feed (the JSON its browser extension uses). Single response, no pagination.
const { getJson } = require('../http');
const { stripHtml } = require('../parse');

function map(e) {
  const hack = /hackathon/i.test(e.url || '') || /hackathon/i.test(e.challenge_type || '');
  return {
    externalId: e.url,
    title: e.title,
    organiser: e.is_hackerearth ? 'HackerEarth' : e.company || '',
    type: hack ? 'HACKATHON' : 'CODING',
    platform: 'HackerEarth',
    url: e.url,
    // Hackathons: you can register until the end; coding contests: the start is what matters
    deadline: hack ? e.end_utc_tz : null,
    startDate: e.start_utc_tz,
    endDate: e.end_utc_tz,
    mode: 'ONLINE',
    eligibility: e.college === 'true' || e.college === true ? ['College students'] : [],
    tags: e.challenge_type ? [e.challenge_type] : [],
    description: stripHtml(e.description),
  };
}

async function fetchListings({ pages } = {}) {
  const j = await getJson('https://www.hackerearth.com/chrome-extension/events/');
  pages?.page(); pages?.done(true);
  return (j.response || []).filter((e) => e.status !== 'COMPLETED').map(map);
}

module.exports = { name: 'hackerearth', label: 'HackerEarth', fetchListings, map };

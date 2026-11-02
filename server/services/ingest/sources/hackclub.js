// Hack Club's public directory of high-school hackathons (documented JSON API, no key).
// https://hackathons.hackclub.com/api/events/upcoming -> [{ id, name, website, start, end, city, state, country, virtual, hybrid, mlhAssociated }]
const { getJson } = require('../http');

const URL_ = process.env.HACKCLUB_API_URL || 'https://hackathons.hackclub.com/api/events/upcoming';

function map(e) {
  return {
    externalId: e.id,
    title: e.name,
    organiser: e.mlhAssociated ? 'MLH member event' : '',
    type: 'HACKATHON',
    platform: 'Hack Club',
    url: e.website,
    // No registration deadline is published; be registered before the event starts
    startDate: e.start,
    endDate: e.end,
    mode: e.virtual ? 'ONLINE' : e.hybrid ? 'HYBRID' : 'OFFLINE',
    city: e.virtual ? '' : e.city || '',
    state: e.virtual ? '' : e.state || '',
    country: e.virtual ? '' : e.country || '',
    eligibility: ['High school students'],
    tags: [e.apac ? 'APAC' : '', e.mlhAssociated ? 'MLH' : ''].filter(Boolean),
    description: 'High-school hackathon listed in the Hack Club directory.',
  };
}

async function fetchListings({ pages } = {}) {
  const rows = await getJson(URL_);
  pages?.page(); pages?.done(true);
  return (Array.isArray(rows) ? rows : rows.events || []).map(map);
}

module.exports = { name: 'hackclub', label: 'Hack Club', fetchListings, map };

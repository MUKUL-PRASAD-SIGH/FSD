// HackerEarth events feed (the JSON its browser extension uses).
const { getJson, stripHtml } = require('../common');

async function fetchListings() {
  const j = await getJson('https://www.hackerearth.com/chrome-extension/events/');
  return (j.response || [])
    .filter((e) => e.status !== 'COMPLETED')
    .map((e) => {
      const hack = /hackathon/i.test(e.url || '') || /hackathon/i.test(e.challenge_type || '');
      return {
        externalId: e.url,
        title: e.title,
        organiser: e.is_hackerearth ? 'HackerEarth' : '',
        type: hack ? 'HACKATHON' : 'CODING',
        platform: 'HackerEarth',
        url: e.url,
        // Hackathons: registration/submission runs until the end; coding contests: the start is what matters
        deadline: new Date(hack ? e.end_utc_tz : e.start_utc_tz),
        mode: 'ONLINE',
        eligibility: e.college === 'true' || e.college === true ? ['College students'] : [],
        tags: e.challenge_type ? [e.challenge_type] : [],
        description: stripHtml(e.description),
      };
    });
}

module.exports = { name: 'hackerearth', fetchListings };

// ETHGlobal events page. Server-rendered Next.js: event data is read from __NEXT_DATA__ props when present,
// otherwise from JSON-LD, otherwise from /events/<slug> cards. Summits/conferences are skipped; hackathons kept.
const cheerio = require('cheerio');
const { getText } = require('../http');
const { nextData, findEventArrays, jsonLdEvents } = require('../parse');
const { genericEvent } = require('../generic');

const BASE = 'https://ethglobal.com';
const urlFor = (slug) => `${BASE}/events/${String(slug).replace(/^\/?(events\/)?/, '')}`;
const isHackathon = (e) => !/summit|conference|meetup|pragma|happy hour/i.test(`${e.type || ''} ${e.name || e.title || ''}`);

function parseHtml(html) {
  const opts = { platform: 'ETHGlobal', organiser: 'ETHGlobal', urlFor, tags: ['Web3'] };
  const nd = nextData(html);
  if (nd) {
    const arrays = findEventArrays(nd.props || nd);
    const events = arrays.flat().filter(isHackathon).map((e) => ({ ...genericEvent(e, opts), tags: ['Web3', 'Ethereum'] }));
    if (events.length) return events;
  }
  const ld = jsonLdEvents(html).filter(isHackathon).map((e) => ({ ...genericEvent(e, opts), tags: ['Web3', 'Ethereum'] }));
  if (ld.length) return ld;
  // Last resort: event cards. Dates are read from <time datetime> inside the card.
  const $ = cheerio.load(html);
  const out = [];
  $('a[href^="/events/"]').each((_, a) => {
    const el = $(a);
    const href = el.attr('href');
    const times = el.find('time[datetime]').map((__, t) => $(t).attr('datetime')).get();
    const title = (el.find('h2,h3,h4').first().text() || el.attr('title') || '').trim();
    if (!title || !times.length || !isHackathon({ name: title })) return;
    out.push({ externalId: href, title, organiser: 'ETHGlobal', type: 'HACKATHON', platform: 'ETHGlobal', url: BASE + href, startDate: times[0], endDate: times[1], mode: /online|async/i.test(title + el.text()) ? 'ONLINE' : 'OFFLINE', tags: ['Web3', 'Ethereum'] });
  });
  return out;
}

async function fetchListings({ pages } = {}) {
  const html = await getText(`${BASE}/events`);
  pages?.page(); pages?.done(true);
  return parseHtml(html);
}

module.exports = { name: 'ethglobal', label: 'ETHGlobal', fetchListings, parseHtml };

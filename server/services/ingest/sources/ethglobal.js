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
  // Fallback: event cards (what the live page renders today). Two layouts:
  //   "Sep 4th" + "Sep 16th, 2026" in <time> tags, or a month label with start/end day spans (year only in the slug).
  const $ = cheerio.load(html);
  const out = [];
  const seen = new Set();
  const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const iso = (y, m, d) => (m == null || !d ? null : new Date(Date.UTC(y, m, d, 12)).toISOString());
  const dayMonth = (t) => { const m = /([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})/.exec(t || ''); return m ? { m: MONTHS[m[1].toLowerCase()], d: Number(m[2]) } : null; };
  $('a[href^="/events/"]').each((_, a) => {
    const el = $(a);
    const href = el.attr('href').split('?')[0];
    if (seen.has(href)) return;
    const title = (el.find('h1,h2,h3,h4,h5').first().text() || '').trim();
    if (!title || !isHackathon({ name: title })) return;
    const year = Number((/(20\d\d)/.exec(href) || [])[1]) || new Date().getUTCFullYear();
    let start; let end;
    const times = [...new Set(el.find('time').map((__, t) => $(t).text().trim()).get())];
    if (times.length) {
      const s0 = dayMonth(times[0]); const s1 = dayMonth(times[times.length - 1]) || s0;
      const y = Number((/(20\d\d)/.exec(times[times.length - 1]) || [])[1]) || year;
      if (s0 && s1) { start = iso(y, s0.m, s0.d); end = iso(y, s1.m, s1.d); }
    } else {
      const month = MONTHS[(el.find('.uppercase').first().text().trim().slice(0, 3) || '').toLowerCase()];
      const days = el.find('section span').map((__, t) => $(t).text().trim()).get().filter((t) => /^\d{1,2}$/.test(t)).map(Number);
      if (month != null && days.length) { start = iso(year, month, days[0]); end = iso(year, month, days[days.length - 1]); }
    }
    if (!end) return;
    seen.add(href);
    const text = el.text();
    const city = /online|async/i.test(title + text) ? '' : (el.find('section').text().match(/(?:^|[a-z0-9])([A-Z][a-zA-Z .]+),\s*([A-Z][a-zA-Z .]+)(?=IRL|Hackathon|Apply|$)/) || [])[1] || '';
    out.push({ externalId: href, title, organiser: 'ETHGlobal', type: 'HACKATHON', platform: 'ETHGlobal', url: BASE + href, startDate: start, endDate: end, mode: /online|async/i.test(title + text) ? 'ONLINE' : 'OFFLINE', city, tags: ['Web3', 'Ethereum'] });
  });
  return out;
}

async function fetchListings({ pages } = {}) {
  const html = await getText(`${BASE}/events`);
  pages?.page(); pages?.done(true);
  return parseHtml(html);
}

module.exports = { name: 'ethglobal', label: 'ETHGlobal', fetchListings, parseHtml };

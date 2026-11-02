// Major League Hacking season calendar (HTML). Each event card carries schema.org microdata
// (itemprop="name|url|startDate|endDate|addressLocality|addressRegion") and a format note
// ("Digital Only" / "Hybrid" / "In-Person Only"). JSON-LD Event blocks are used as a fallback.
// MLH seasons are named by the year they end: the 2027 season runs Jul 2026 - Jun 2027.
const cheerio = require('cheerio');
const { getText } = require('../http');
const { jsonLdEvents } = require('../parse');
const { genericEvent } = require('../generic');

const seasonFor = (d) => (d.getUTCMonth() >= 6 ? d.getUTCFullYear() + 1 : d.getUTCFullYear());
const pageUrl = (season) => (process.env.MLH_EVENTS_URL || 'https://mlh.io/seasons/{season}/events').replace('{season}', season);

function parseHtml(html) {
  const $ = cheerio.load(html);
  const out = [];
  $('[itemtype*="schema.org/Event"], .event').each((_, el) => {
    const card = $(el);
    const prop = (p) => card.find(`[itemprop="${p}"]`).first();
    const title = (prop('name').attr('content') || prop('name').text() || card.find('.event-name').text()).trim();
    const url = prop('url').attr('href') || prop('url').attr('content') || card.find('a').first().attr('href');
    const start = prop('startDate').attr('content') || prop('startDate').attr('datetime');
    const end = prop('endDate').attr('content') || prop('endDate').attr('datetime');
    if (!title || !start) return;
    const notes = `${card.find('.event-hybrid-notes, [class*="format"]').text()} ${card.text()}`.toLowerCase();
    const mode = /digital only|online|virtual/.test(notes) && !/hybrid/.test(notes) ? 'ONLINE' : /hybrid/.test(notes) ? 'HYBRID' : 'OFFLINE';
    const city = (prop('addressLocality').text() || prop('city').text()).trim();
    const state = (prop('addressRegion').text() || prop('state').text()).trim();
    const hs = /high school/.test(notes) || card.is('.event-hs');
    out.push({
      externalId: url || `${title}-${start}`,
      title,
      organiser: 'MLH',
      type: 'HACKATHON',
      platform: 'MLH',
      url,
      startDate: start,
      endDate: end,
      mode,
      city: mode === 'ONLINE' ? '' : city,
      state: mode === 'ONLINE' ? '' : state,
      eligibility: [hs ? 'High school students' : 'University students'],
      tags: ['MLH'],
      description: `MLH ${mode === 'ONLINE' ? 'digital' : mode === 'HYBRID' ? 'hybrid' : 'in-person'} hackathon.`,
    });
  });
  if (out.length) return out;
  return jsonLdEvents(html).map((e) => genericEvent(e, { platform: 'MLH', organiser: 'MLH', eligibility: ['University students'] }));
}

async function fetchListings({ pages, now = new Date() } = {}) {
  const seasons = [seasonFor(now)];
  if (now.getUTCMonth() >= 3 && now.getUTCMonth() < 6) seasons.push(seasonFor(now) + 1); // next season is published in spring
  const out = [];
  for (const s of seasons) {
    const html = await getText(pageUrl(s));
    pages?.page();
    out.push(...parseHtml(html));
  }
  pages?.done(true);
  return out;
}

module.exports = { name: 'mlh', label: 'MLH', fetchListings, parseHtml, seasonFor };

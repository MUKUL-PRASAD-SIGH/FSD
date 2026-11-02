// AtCoder upcoming contests (HTML table #contest-table-upcoming; times carry a +0900 offset).
const cheerio = require('cheerio');
const { getText } = require('../http');

function parseHtml(html) {
  const $ = cheerio.load(html);
  const out = [];
  $('#contest-table-upcoming tbody tr').each((_, tr) => {
    const td = $(tr).find('td');
    const time = td.eq(0).find('time').text().trim() || td.eq(0).text().trim();
    const a = td.eq(1).find('a[href^="/contests/"]').first();
    const href = a.attr('href');
    if (!href) return;
    const slug = href.split('/')[2];
    const [h, m] = td.eq(2).text().trim().split(':').map(Number);
    out.push({
      externalId: slug,
      title: a.text().trim(),
      organiser: 'AtCoder',
      type: 'CODING',
      platform: 'AtCoder',
      url: `https://atcoder.jp${href}`,
      tz: 'Asia/Tokyo',
      startDate: time.replace(/\+0900$/, '+09:00'),
      mode: 'ONLINE',
      tags: ['Algorithms', td.eq(3).text().trim() ? `Rated ${td.eq(3).text().trim()}` : ''].filter(Boolean),
      skills: ['DSA'],
      description: Number.isFinite(h) ? `${h * 60 + (m || 0)} minute contest.` : '',
    });
  });
  return out;
}

async function fetchListings({ pages } = {}) {
  const html = await getText('https://atcoder.jp/contests/?lang=en');
  pages?.page(); pages?.done(true);
  return parseHtml(html);
}

module.exports = { name: 'atcoder', label: 'AtCoder', fetchListings, parseHtml };

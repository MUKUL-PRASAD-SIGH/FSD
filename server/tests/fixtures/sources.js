// CONSTRUCTED fixtures for adapter tests. These are NOT live captures: the sandbox that built them could not reach
// any listing site. Field names follow what each adapter reads (for the original 7 sources, the names the adapters
// used when they were last run live). Re-record real payloads with `npm run sources:check -- --record` on a machine with access.
const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString();
const fmtRange = (a, b) => {
  const m = (d) => d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const dd = (d) => String(d.getUTCDate()).padStart(2, '0');
  return `${m(a)} ${dd(a)} - ${m(b)} ${dd(b)}, ${b.getUTCFullYear()}`;
};

function devpostPages(now) {
  const mk = (i, range, extra = {}) => ({
    id: 1000 + i, title: `Devpost Hack ${i}`, url: `https://hack${i}.devpost.com/`, organization_name: `Org ${i}`,
    submission_period_dates: range, displayed_location: { icon: i % 2 ? 'globe' : 'map-marker-alt', location: i % 2 ? 'Online' : 'Bengaluru, Karnataka, India' },
    prize_amount: `$<span data-currency-value>${(i + 1) * 1000}</span>`, themes: [{ name: 'Machine Learning/AI' }], registrations_count: 100 + i, open_state: 'open', invite_only: false, ...extra,
  });
  const a = new Date(now.getTime() - 5 * DAY);
  const b = new Date(now.getTime() + 20 * DAY);
  const all = [];
  for (let i = 0; i < 21; i++) all.push(mk(i, fmtRange(a, b)));
  // the short form the old parser dropped: "Nov 03 - 15, 2026"
  const s = new Date(now.getTime() + 2 * DAY); const e = new Date(now.getTime() + 9 * DAY);
  const sameMonth = s.getUTCMonth() === e.getUTCMonth();
  all.push(mk(21, sameMonth ? `${s.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ${String(s.getUTCDate()).padStart(2, '0')} - ${String(e.getUTCDate()).padStart(2, '0')}, ${e.getUTCFullYear()}` : fmtRange(s, e)));
  all.push(mk(22, 'garbage date text')); // unparseable -> rejected with a reason
  all.push(mk(23, fmtRange(new Date(now.getTime() - 30 * DAY), new Date(now.getTime() - 2 * DAY)))); // expired
  all.push(mk(24, fmtRange(a, b), { url: 'not a url' })); // invalid url
  const per = 9;
  return [0, 1, 2].map((p) => ({ hackathons: all.slice(p * per, p * per + per), meta: { total_count: all.length, per_page: per } }));
}

function unstopPage(kind, page, lastPage, now) {
  const data = [];
  for (let i = 0; i < 3; i++) {
    const id = `${kind}-${page}-${i}`;
    data.push({
      id, title: `${kind} ${page}.${i}${kind === 'competitions' && i === 0 ? ' Case Study Challenge' : ''}`, organisation: { name: 'IIT Somewhere' },
      seo_url: `https://unstop.com/${kind}/${id}`, visibility: 'public', regn_open: 1, region: i === 2 ? 'offline' : 'online',
      regnRequirements: { end_regn_dt: iso(now.getTime() + (3 + i) * DAY).replace('Z', '+00:00'), min_team_size: 1, max_team_size: 4 },
      start_date: iso(now.getTime() + 4 * DAY), end_date: iso(now.getTime() + 6 * DAY),
      prizes: [{ cash: 50000 }, { cash: 25000 }], address_with_country_logo: { city: i === 2 ? 'Pune' : '', state: i === 2 ? 'Maharashtra' : '' },
      filters: [{ name: 'Engineering Students' }], required_skills: [{ skill_name: 'Python' }], details: '<p>Build <b>things</b></p>', registerCount: 120,
    });
  }
  return { data: { data, last_page: lastPage, current_page: page } };
}

const mlhHtml = (now) => {
  const d = (n) => new Date(now.getTime() + n * DAY).toISOString().slice(0, 10);
  return `<html><body>
  <div class="event" itemscope itemtype="http://schema.org/Event"><div class="event-wrapper">
    <a class="event-link" href="https://hackfoo.example.org/?utm_source=mlh" itemprop="url" title="HackFoo">
      <h3 class="event-name" itemprop="name">HackFoo</h3><p class="event-date">Soon</p>
      <meta itemprop="startDate" content="${d(10)}"><meta itemprop="endDate" content="${d(12)}">
      <div class="event-location" itemprop="location" itemscope itemtype="http://schema.org/Place">
        <span itemprop="city">Boston</span><span itemprop="state">MA</span></div>
      <div class="event-hybrid-notes"><span>In-Person Only</span></div></a></div></div>
  <div class="event" itemscope itemtype="http://schema.org/Event"><div class="event-wrapper">
    <a class="event-link" href="https://digitalhack.example.org/" itemprop="url">
      <h3 class="event-name" itemprop="name">Digital Hack</h3>
      <meta itemprop="startDate" content="${d(20)}"><meta itemprop="endDate" content="${d(21)}">
      <div class="event-hybrid-notes"><span>Digital Only</span></div></a></div></div>
  </body></html>`;
};

const atcoderHtml = (now) => {
  const t = new Date(now.getTime() + 3 * DAY + 9 * 3600000).toISOString().slice(0, 19).replace('T', ' ') + '+0900';
  return `<div id="contest-table-upcoming"><table><tbody>
    <tr><td><a href="http://www.timeanddate.com/x"><time class="fixtime fixtime-full">${t}</time></a></td>
        <td><span>Ⓐ</span> <a href="/contests/abc999">AtCoder Beginner Contest 999</a></td><td>01:40</td><td> - 1999</td></tr>
  </tbody></table></div>`;
};

const ethglobalHtml = (now) => `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
  props: { pageProps: { events: [
    { id: 'e1', name: 'ETHGlobal Bangkok', slug: 'bangkok', startTime: iso(now.getTime() + 15 * DAY), endTime: iso(now.getTime() + 17 * DAY), city: 'Bangkok', isVirtual: false },
    { id: 'e2', name: 'ETHGlobal Online', slug: 'online2026', startTime: iso(now.getTime() + 25 * DAY), endTime: iso(now.getTime() + 45 * DAY), isVirtual: true },
    { id: 'e3', name: 'Pragma Summit', slug: 'pragma', type: 'summit', startTime: iso(now.getTime() + 15 * DAY) },
  ] } },
})}</script></html>`;

const hackclub = (now) => [
  { id: 'hc1', name: 'Hack Teen', website: 'https://hackteen.example.org', start: iso(now.getTime() + 8 * DAY), end: iso(now.getTime() + 9 * DAY), city: 'Delhi', country: 'India', virtual: false, hybrid: false },
  { id: 'hc2', name: 'Online HS Hack', website: 'https://hshack.example.org', start: iso(now.getTime() + 18 * DAY), end: iso(now.getTime() + 19 * DAY), virtual: true },
];

module.exports = { devpostPages, unstopPage, mlhHtml, atcoderHtml, ethglobalHtml, hackclub, DAY };

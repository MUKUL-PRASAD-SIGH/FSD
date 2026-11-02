// Competitive-programming contest calendars: Codeforces, CodeChef and LeetCode.
// For contests the "deadline" is the start time (you must be registered and ready by then).
const { getJson } = require('../http');

const one = (pages) => { pages?.page(); pages?.done(true); };

const codeforces = {
  name: 'codeforces',
  label: 'Codeforces',
  map: (c) => ({
    externalId: c.id, title: c.name, organiser: 'Codeforces', type: 'CODING', platform: 'Codeforces',
    url: `https://codeforces.com/contests/${c.id}`, startDate: c.startTimeSeconds, endDate: c.startTimeSeconds + (c.durationSeconds || 0), mode: 'ONLINE',
    tags: ['Algorithms', c.type].filter(Boolean), skills: ['DSA'], description: `${Math.round((c.durationSeconds || 0) / 60)} minute rated contest.`,
  }),
  async fetchListings({ pages } = {}) {
    const j = await getJson('https://codeforces.com/api/contest.list?gym=false');
    one(pages);
    if (j.status && j.status !== 'OK') throw new Error(`codeforces: ${j.comment || j.status}`);
    return (j.result || []).filter((c) => c.phase === 'BEFORE').map(codeforces.map);
  },
};

const codechef = {
  name: 'codechef',
  label: 'CodeChef',
  map: (c, ongoing) => ({
    externalId: c.contest_code, title: c.contest_name, organiser: 'CodeChef', type: 'CODING', platform: 'CodeChef',
    url: `https://www.codechef.com/${c.contest_code}`, tz: 'Asia/Kolkata',
    // Ongoing long contests can still be joined until they end; future ones must be joined by the start
    deadline: ongoing ? c.contest_end_date_iso || c.contest_end_date : null, deadlineKind: ongoing ? 'event_end' : undefined,
    startDate: c.contest_start_date_iso || c.contest_start_date, endDate: c.contest_end_date_iso || c.contest_end_date, mode: 'ONLINE',
    tags: ['Algorithms'], skills: ['DSA'], description: c.contest_duration ? `${c.contest_duration} minute contest.` : '',
  }),
  async fetchListings({ pages } = {}) {
    const j = await getJson('https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=all');
    one(pages);
    return [...(j.present_contests || []).map((c) => codechef.map(c, true)), ...(j.future_contests || []).map((c) => codechef.map(c, false))];
  },
};

const leetcode = {
  name: 'leetcode',
  label: 'LeetCode',
  map: (c) => ({
    externalId: c.titleSlug, title: c.title, organiser: 'LeetCode', type: 'CODING', platform: 'LeetCode',
    url: `https://leetcode.com/contest/${c.titleSlug}`, startDate: c.startTime, endDate: c.startTime + (c.duration || 0), mode: 'ONLINE',
    tags: ['Algorithms'], skills: ['DSA'], description: `${Math.round((c.duration || 0) / 60)} minute contest.`,
  }),
  async fetchListings({ pages } = {}) {
    const j = await getJson('https://leetcode.com/graphql', { method: 'POST', body: { query: '{ upcomingContests { title titleSlug startTime duration } }' } });
    one(pages);
    return (j.data?.upcomingContests || []).map(leetcode.map);
  },
};

module.exports = [codeforces, codechef, leetcode];

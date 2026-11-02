// Competitive-programming contest calendars: Codeforces, CodeChef and LeetCode.
// For contests, `deadline` is the start time (the moment you must be ready).
const { getJson } = require('../common');

const codeforces = {
  name: 'codeforces',
  async fetchListings() {
    const j = await getJson('https://codeforces.com/api/contest.list?gym=false');
    return (j.result || [])
      .filter((c) => c.phase === 'BEFORE')
      .map((c) => ({
        externalId: c.id, title: c.name, organiser: 'Codeforces', type: 'CODING', platform: 'Codeforces',
        url: `https://codeforces.com/contests/${c.id}`, deadline: new Date(c.startTimeSeconds * 1000), mode: 'ONLINE',
        tags: ['Algorithms', c.type].filter(Boolean), skills: ['DSA'], description: `${Math.round(c.durationSeconds / 60)} minute rated contest.`,
      }));
  },
};

const codechef = {
  name: 'codechef',
  async fetchListings() {
    const j = await getJson('https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=all');
    return [...(j.present_contests || []), ...(j.future_contests || [])].map((c) => ({
      externalId: c.contest_code, title: c.contest_name, organiser: 'CodeChef', type: 'CODING', platform: 'CodeChef',
      url: `https://www.codechef.com/${c.contest_code}`, deadline: new Date(c.contest_end_date_iso || c.contest_start_date_iso), mode: 'ONLINE',
      tags: ['Algorithms'], skills: ['DSA'], description: `${c.contest_duration} minute contest.`,
    }));
  },
};

const leetcode = {
  name: 'leetcode',
  async fetchListings() {
    const j = await getJson('https://leetcode.com/graphql', { method: 'POST', body: { query: '{ upcomingContests { title titleSlug startTime duration } }' } });
    return (j.data?.upcomingContests || []).map((c) => ({
      externalId: c.titleSlug, title: c.title, organiser: 'LeetCode', type: 'CODING', platform: 'LeetCode',
      url: `https://leetcode.com/contest/${c.titleSlug}`, deadline: new Date(c.startTime * 1000), mode: 'ONLINE',
      tags: ['Algorithms'], skills: ['DSA'], description: `${Math.round(c.duration / 60)} minute contest.`,
    }));
  },
};

module.exports = [codeforces, codechef, leetcode];

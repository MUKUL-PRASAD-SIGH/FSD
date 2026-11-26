// What the recommendation engine still needs from a person. The onboarding flow (client /welcome) asks ONLY for these,
// so someone who uploaded a resume skips everything it already told us.
const GOALS = ['win prizes', 'learn new tech', 'build my portfolio', 'find a team', 'get internships', 'meet people'];

const FIELDS = [
  { field: 'city', why: 'to rank events you can actually attend', weight: 15, has: (u) => !!(u.location?.city || u.location?.state) },
  { field: 'college', why: 'to surface college-only and campus events', weight: 10, has: (u) => !!u.college },
  { field: 'education', why: 'to filter out events you are not eligible for', weight: 15, has: (u) => !!u.education?.level },
  { field: 'gradYear', why: 'to match student-only and year-specific events', weight: 5, has: (u) => !!u.education?.gradYear || u.education?.level === 'working' },
  { field: 'skills', why: 'the strongest signal for what fits you', weight: 25, has: (u) => new Set([...(u.skills || []), ...(u.resume?.skills || [])]).size >= 3 },
  { field: 'interests', why: 'so the feed leads with domains you care about', weight: 15, has: (u) => (u.interests || []).length >= 1 },
  { field: 'modes', why: 'online, in person or both', weight: 10, has: (u) => (u.preferences?.modes || []).length >= 1 },
  { field: 'types', why: 'hackathons, case studies, contests…', weight: 5, has: (u) => (u.preferences?.types || []).length >= 1 },
];

function gaps(u) {
  const missing = FIELDS.filter((f) => !f.has(u)).map(({ field, why }) => ({ field, why }));
  const completeness = FIELDS.reduce((s, f) => s + (f.has(u) ? f.weight : 0), 0);
  return {
    missing,
    completeness, // 0-100
    fromResume: u.resume?.parsedAt ? { skills: (u.resume.skills || []).slice(0, 15) } : null,
    done: !!u.onboarding?.completedAt,
    skipped: !!u.onboarding?.skippedAt,
    goals: u.onboarding?.goals || [],
  };
}

module.exports = { gaps, GOALS, FIELDS };

// Field-name-tolerant mapping for sources whose payloads are embedded page data (Next.js props, JSON-LD) or
// whose schema is not formally documented. It looks for the usual names for each concept instead of relying
// on one exact schema, so a renamed field degrades a record instead of breaking the adapter.
const { stripHtml, parsePrize } = require('./parse');

const first = (o, keys) => {
  for (const k of keys) {
    const v = k.split('.').reduce((x, p) => (x == null ? x : x[p]), o);
    if (v != null && v !== '') return v;
  }
  return null;
};

const TITLE = ['title', 'name', 'event_name', 'eventName', 'headline'];
const START = ['startDate', 'start_date', 'startTime', 'start_time', 'starts_at', 'startsAt', 'start', 'begin_time', 'beginTime'];
const END = ['endDate', 'end_date', 'endTime', 'end_time', 'ends_at', 'endsAt', 'end'];
const DEADLINE = ['registrationEndDate', 'registration_end', 'reg_end_time', 'regEndTime', 'registration_deadline', 'deadline', 'submission_deadline', 'submissionEndDate', 'submission_end_time'];
const URL_KEYS = ['url', 'link', 'website', 'href', 'event_url', 'eventUrl'];
const SLUG = ['slug', 'uname', 'handle', 'path', 'id'];
const CITY = ['city', 'location.address.addressLocality', 'location.city', 'address.city', 'venue.city'];
const COUNTRY = ['country', 'location.address.addressCountry', 'location.country', 'address.country'];
const PRIZE = ['total_prize', 'totalPrize', 'prize_pool', 'prizePool', 'prize', 'prizes_total', 'reward', 'bounty'];

function genericEvent(e, { platform, type = 'HACKATHON', tz = 'UTC', urlFor, organiser = '', defaultCurrency = 'USD', eligibility = [] }) {
  const title = first(e, TITLE);
  let url = first(e, URL_KEYS);
  if (url && typeof url === 'object') url = url.url || url.href || null;
  if (url && urlFor && !/^https?:\/\//i.test(url)) url = urlFor(url, e);
  if (!url && urlFor) { const slug = first(e, SLUG); if (slug != null) url = urlFor(slug, e); }
  const loc = typeof e.location === 'string' ? e.location : '';
  const attendance = String(e.eventAttendanceMode || e.attendance || e.format || e.mode || '').toLowerCase();
  const virtual = e.isVirtual ?? e.is_virtual ?? e.virtual ?? e.online ?? e.is_online;
  const hybrid = e.hybrid ?? e.isHybrid;
  const mode = hybrid || /mixed|hybrid/.test(attendance) ? 'HYBRID'
    : virtual === true || /online|virtual/.test(attendance) || /online|virtual|remote/i.test(loc) ? 'ONLINE'
      : virtual === false || /offline|in.?person/.test(attendance) || first(e, CITY) ? 'OFFLINE' : 'ONLINE';
  let prizeRaw = first(e, PRIZE);
  if (prizeRaw && typeof prizeRaw === 'object') prizeRaw = prizeRaw.amount ?? prizeRaw.value ?? null;
  const prize = prizeRaw != null ? parsePrize(prizeRaw, defaultCurrency) : null;
  const org = first(e, ['organizer.name', 'organiser', 'organizer', 'organization', 'host', 'sponsor']);
  const tags = first(e, ['tags', 'themes', 'tracks', 'categories', 'keywords']);
  return {
    externalId: first(e, ['id', 'uuid', 'slug', 'uname']) ?? url,
    title: typeof title === 'string' ? stripHtml(title) : title,
    organiser: typeof org === 'string' ? org : organiser,
    type,
    platform,
    url,
    tz,
    deadline: first(e, DEADLINE),
    startDate: first(e, START),
    endDate: first(e, END),
    mode,
    city: mode === 'ONLINE' ? '' : String(first(e, CITY) || (loc.split(',')[0] || '')).trim(),
    country: mode === 'ONLINE' ? '' : String(first(e, COUNTRY) || '').trim(),
    prizeLabel: prize?.label, prizeInr: prize?.inr, prizeAmount: prize?.amount, prizeCurrency: prize?.currency,
    eligibility,
    tags: Array.isArray(tags) ? tags.map((t) => (typeof t === 'string' ? t : t?.name || t?.title)).filter(Boolean) : typeof tags === 'string' ? tags.split(',').map((s) => s.trim()) : [],
    description: stripHtml(first(e, ['description', 'tagline', 'summary', 'intro', 'short_description']) || ''),
    registered: Number(first(e, ['participants_count', 'participantsCount', 'registrations', 'registrationCount', 'hackers', 'participants'])) || null,
  };
}

module.exports = { genericEvent, first };

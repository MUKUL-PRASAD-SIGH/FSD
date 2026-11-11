// Rule-based natural-language query parser for "Ask". No external LLM is used:
// it turns phrases like "AI hackathons closing soon with 1L+ prize" into a Mongo filter
// plus free-text terms, then results are ranked by the recommender.
const { extractSkills } = require('./skills');
const { canonicalCity, listingCountry, normCountry } = require('../utils/geo');

const TYPE_WORDS = [
  [/case (comp|competition|study|studies)/i, 'CASE STUDY'],
  [/hackathon/i, 'HACKATHON'],
  [/coding contest|contest|codeforces|codechef/i, 'CONTEST'],
  [/quiz/i, 'QUIZ'],
  [/design/i, 'DESIGN'],
  [/innovation/i, 'INNOVATION'],
];

function parsePrize(q) {
  const m = q.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(l|lakh|lakhs|cr|crore|k|thousand)\b\s*\+?/i);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit.startsWith('l')) return n * 1e5;
  if (unit.startsWith('c')) return n * 1e7;
  return n * 1e3;
}

// ---- Place: "bangalore hackathons", "hackathons in Dhaka", "events near pune", "in the USA" ----
const COUNTRY_WORDS = /\b(india|bharat|usa|u\.s\.a|united states|america|uk|united kingdom|england|uae|united arab emirates|bangladesh|nepal|sri lanka|singapore|germany|canada|australia|france|japan|nigeria|kenya)\b/i;
const STOP = /^(the|a|an|my|me|any|all|online|offline|person|home|free|here|there|india|usa|uk|time|general|ai|ml|web|data|college|students?|school|2026|2027)$/i;
function parsePlace(q) {
  const city = canonicalCity(q);
  if (city) return { kind: 'city', key: city, label: city === 'delhi-ncr' ? 'Delhi NCR' : city[0].toUpperCase() + city.slice(1) };
  const c = q.match(COUNTRY_WORDS);
  if (c) return { kind: 'country', key: normCountry(c[1].replace(/\./g, '')), label: c[1] };
  const m = q.match(/\b(?:in|near|at|around|from)\s+([a-z][a-z .'-]{2,28}?)(?=\s+(?:hackathons?|events?|contests?|competitions?|with|closing|this|for|that|under|and|or|having|where|please)\b|[?.!,]|$)/i);
  if (m && !STOP.test(m[1].trim())) return { kind: 'text', key: m[1].trim().toLowerCase(), label: m[1].trim() };
  return null;
}

// Does a listing happen at the place? Online events are location-agnostic and handled by the caller.
function matchesPlace(l, place) {
  if (!place) return true;
  const blob = [l.city, l.state, l.venue, l.country, l.title, l.organiser].filter(Boolean).join(' ');
  if (place.kind === 'city') return canonicalCity(blob) === place.key;
  if (place.kind === 'country') return listingCountry(l) === place.key || normCountry(blob.split(/[\s,]+/).pop()) === place.key || new RegExp('\b' + place.key + '\b', 'i').test(blob);
  return blob.toLowerCase().includes(place.key);
}

function parseAsk(question) {
  const q = question.trim();
  const filter = {};
  const applied = [];

  for (const [re, type] of TYPE_WORDS) {
    if (re.test(q)) { filter.type = type; applied.push(type.toLowerCase()); break; }
  }
  if (/\bonline|remote|virtual\b/i.test(q)) { filter.mode = 'ONLINE'; applied.push('online'); }
  else if (/in[- ]person|offline|on[- ]site/i.test(q)) { filter.mode = 'OFFLINE'; applied.push('in person'); }
  if (/\bfree\b/i.test(q)) { filter.fee = /free/i; applied.push('free entry'); }

  const now = new Date();
  if (/closing soon|this week|urgent|last minute|ending soon/i.test(q)) {
    filter.deadline = { $gte: now, $lte: new Date(now.getTime() + 7 * 86400000) };
    applied.push('closing within 7 days');
  } else if (/this month/i.test(q)) {
    filter.deadline = { $gte: now, $lte: new Date(now.getTime() + 30 * 86400000) };
    applied.push('closing within 30 days');
  } else {
    filter.deadline = { $gte: now };
  }

  const prize = parsePrize(q);
  if (prize) { filter.prizeInr = { $gte: prize }; applied.push(`prize ≥ ₹${prize.toLocaleString('en-IN')}`); }

  // Explicitly online queries are location-agnostic: "online hackathons in India" keeps every online event.
  const place = filter.mode === 'ONLINE' ? null : parsePlace(q);
  if (place) {
    applied.push(`in ${place.label}`);
    if (!filter.mode) { filter.mode = { $ne: 'ONLINE' }; applied.push('in-person'); }
  }

  const skills = extractSkills(q).map((s) => s.name);
  if (skills.length) applied.push(`about ${skills.slice(0, 3).join(', ')}`);

  return { filter, skills, applied, text: q, place };
}

// In-memory equivalent of the Mongo filter, used by the RAG retriever on its candidate pool
function matchesFilter(l, f) {
  if (f.type && l.type !== f.type) return false;
  if (f.mode && (typeof f.mode === 'string' ? l.mode !== f.mode : l.mode === 'ONLINE')) return false;
  if (f.fee && !f.fee.test(l.fee || '')) return false;
  if (f.prizeInr && !((l.prizeInr || 0) >= f.prizeInr.$gte)) return false;
  const d = new Date(l.deadline);
  if (f.deadline?.$lte && d > f.deadline.$lte) return false;
  return true;
}

module.exports = { parseAsk, matchesFilter, matchesPlace, parsePlace };

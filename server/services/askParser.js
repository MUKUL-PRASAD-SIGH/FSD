// Rule-based natural-language query parser for "Ask". No external LLM is used:
// it turns phrases like "AI hackathons closing soon with 1L+ prize" into a Mongo filter
// plus free-text terms, then results are ranked by the recommender.
const { extractSkills } = require('./skills');

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

  const skills = extractSkills(q).map((s) => s.name);
  if (skills.length) applied.push(`about ${skills.slice(0, 3).join(', ')}`);

  return { filter, skills, applied, text: q };
}

module.exports = { parseAsk };

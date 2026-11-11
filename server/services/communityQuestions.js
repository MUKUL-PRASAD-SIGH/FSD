// Anonymous aggregation of what people ask about an event. See models/ListingQuestion.js for the privacy design:
// no user id / IP / session is stored; text is PII-scrubbed; questions that contained anything personal are dropped.
const crypto = require('crypto');
const ListingQuestion = require('../models/ListingQuestion');
const { scrubPii, containsPii } = require('../utils/pii');

const STOP = new Set('the a an and or of to in for on with at by from is are be as this that it we you your our will can do does did what when where who how which any there their about me my i please tell us hackathon event'.split(' '));
const stem = (t) => (t.length > 4 ? t.replace(/(ing|ed|es|s)$/, '') : t);

const words = (q) => [...new Set(String(q).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((t) => t.length > 1 && !STOP.has(t)).map(stem))].sort();
const keyOf = (q) => crypto.createHash('sha1').update(words(q).join(' ')).digest('hex').slice(0, 24);

// Returns true when the question was counted. Never throws: analytics must not break answering.
async function record(listingId, question) {
  try {
    const raw = String(question || '').replace(/\s+/g, ' ').trim();
    if (raw.length < 8 || containsPii(raw) || words(raw).length < 2) return false;
    const text = scrubPii(raw, 160);
    await ListingQuestion.updateOne(
      { listing: listingId, key: keyOf(text) },
      { $inc: { count: 1 }, $set: { lastAskedAt: new Date() }, $setOnInsert: { text, firstAskedAt: new Date() } },
      { upsert: true }
    );
    return true;
  } catch (e) { console.warn('community question not recorded:', e.message); return false; }
}

// Shown to everyone: only questions asked at least twice, so a one-off personal phrasing is never surfaced.
const popular = (listingId, { min = 2, limit = 8 } = {}) =>
  ListingQuestion.find({ listing: listingId, count: { $gte: min } }).sort({ count: -1, lastAskedAt: -1 }).limit(limit).select('text count -_id').lean();

// For the organiser of the event (and admins): every aggregated question, still anonymous.
async function forOrganiser(listingId) {
  const rows = await ListingQuestion.find({ listing: listingId }).sort({ count: -1, lastAskedAt: -1 }).limit(100).select('text count lastAskedAt -_id').lean();
  return { total: rows.reduce((n, r) => n + r.count, 0), distinct: rows.length, questions: rows };
}

module.exports = { record, popular, forOrganiser, keyOf, words };

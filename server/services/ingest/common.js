// Backwards-compatible facade over the ingestion helpers (http.js, parse.js, validate.js).
const { getJson, getText, paginate } = require('./http');
const { stripHtml, rupees, parsePrize, parseDate, parseDateRange } = require('./parse');
const { validate } = require('./validate');

const USD_TO_INR = () => Number(process.env.USD_TO_INR || 84);
const usdToInr = (usd) => Math.round(usd * USD_TO_INR());
const isOpen = (d) => d instanceof Date && !isNaN(d) && d.getTime() > Date.now();

// Applies the same normalisation the runner uses; returns the stored shape (or null when the record is not storable).
function normalise(raw) {
  const v = validate({ deadline: raw.deadline || new Date(Date.now() + 86400000), url: raw.url || 'https://example.com', ...raw });
  return v.status === 'valid' ? v.item : null;
}

// Shared shape for a prize: { prizeLabel, prizeInr, prizeAmount, prizeCurrency }
function prizeFields(input, currency = 'USD') {
  const p = parsePrize(input, currency);
  return p ? { prizeLabel: p.label, prizeInr: p.inr, prizeAmount: p.amount, prizeCurrency: p.currency } : { prizeLabel: 'See listing', prizeInr: null };
}

module.exports = { getJson, getText, paginate, stripHtml, rupees, usdToInr, isOpen, normalise, prizeFields, parseDate, parseDateRange };

// Parsing helpers shared by adapters: timezone-aware dates, date ranges, prize amounts with currency.
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };

// Offset (ms) of `tz` from UTC at the given instant, using Intl (no tz database dependency).
function tzOffsetMs(utcMs, tz) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

// Wall-clock time in `tz` -> Date (UTC instant). Handles DST by re-checking the offset once.
function zoned(y, mo, d, h = 0, mi = 0, s = 0, tz = 'UTC') {
  const guess = Date.UTC(y, mo, d, h, mi, s);
  if (tz === 'UTC') return new Date(guess);
  let t = guess - tzOffsetMs(guess, tz);
  t = guess - tzOffsetMs(t, tz);
  return new Date(t);
}

const valid = (d) => d instanceof Date && !isNaN(d.getTime());

// Accepts: Date, epoch seconds or ms (number or numeric string), ISO strings with or without offset,
// "2026-11-07 21:00:00+0900", "YYYY-MM-DD HH:mm" (interpreted in `tz`), "Nov 12, 2026" (end of day if endOfDay).
function parseDate(v, { tz = 'UTC', endOfDay = false } = {}) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return valid(v) ? v : null;
  if (typeof v === 'number' || /^\d{9,13}$/.test(String(v).trim())) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return null;
    const d = new Date(n < 1e11 ? n * 1000 : n); // seconds vs milliseconds
    return valid(d) ? d : null;
  }
  const s = String(v).trim();
  // ISO / SQL-ish with explicit offset or Z
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})$/i);
  if (m) {
    const off = m[7].toUpperCase() === 'Z' ? '+00:00' : m[7].length === 5 ? `${m[7].slice(0, 3)}:${m[7].slice(3)}` : m[7];
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] || '00'}${off}`);
    return valid(d) ? d : null;
  }
  // No offset: wall-clock time in the source's timezone
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?$/);
  if (m) {
    const hasTime = m[4] != null;
    const d = zoned(+m[1], +m[2] - 1, +m[3], hasTime ? +m[4] : endOfDay ? 23 : 0, hasTime ? +m[5] : endOfDay ? 59 : 0, hasTime ? +(m[6] || 0) : endOfDay ? 59 : 0, tz);
    return valid(d) ? d : null;
  }
  // "Nov 12, 2026" / "12 Nov 2026" / "November 12 2026"
  m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/) || null;
  let y, mo, d;
  if (m) { mo = MONTHS[m[1].slice(0, 4).toLowerCase()] ?? MONTHS[m[1].slice(0, 3).toLowerCase()]; d = +m[2]; y = +m[3]; }
  else {
    m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/);
    if (m) { mo = MONTHS[m[2].slice(0, 4).toLowerCase()] ?? MONTHS[m[2].slice(0, 3).toLowerCase()]; d = +m[1]; y = +m[3]; }
  }
  if (mo != null && d >= 1 && d <= 31) return zoned(y, mo, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, tz);
  // Last resort: anything Date understands that carries its own zone information
  if (/(Z|[+-]\d{2}:?\d{2}|GMT|UTC)$/i.test(s)) { const x = new Date(s); return valid(x) ? x : null; }
  return null;
}

// Human date ranges as used by Devpost and others. Returns { start, end } (either may be null).
//   "Oct 01 - Nov 12, 2026" | "Nov 03 - 15, 2026" | "Dec 28, 2026 - Jan 03, 2027" | "Nov 12, 2026"
//   "Oct 1 – Nov 12, 2026" (en dash) | "Sep 01, 2026 - Nov 30, 2026"
function parseDateRange(text, { tz = 'UTC' } = {}) {
  const s = String(text || '').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
  if (!s) return { start: null, end: null };
  const [a, b] = s.split(/\s+-\s+|\s+to\s+/i);
  const mon = (x) => MONTHS[(x || '').slice(0, 4).toLowerCase()] ?? MONTHS[(x || '').slice(0, 3).toLowerCase()];
  const part = (x) => {
    const m = (x || '').match(/^(?:([A-Za-z]{3,9})\.?\s+)?(\d{1,2})(?:,?\s+(\d{4}))?$/);
    return m ? { mo: m[1] ? mon(m[1]) : null, d: +m[2], y: m[3] ? +m[3] : null } : null;
  };
  const pa = part(a);
  const pb = b != null ? part(b) : null;
  if (!pa) return { start: null, end: null };
  if (!pb) {
    if (pa.mo == null || pa.y == null) return { start: null, end: null };
    return { start: zoned(pa.y, pa.mo, pa.d, 0, 0, 0, tz), end: zoned(pa.y, pa.mo, pa.d, 23, 59, 59, tz) };
  }
  const endMo = pb.mo ?? pa.mo;
  const endY = pb.y ?? pa.y;
  if (endMo == null || endY == null) return { start: null, end: null };
  let startY = pa.y ?? endY;
  if (pa.y == null && pa.mo != null && pa.mo > endMo) startY = endY - 1; // "Dec 28 - Jan 03, 2027"
  const start = pa.mo != null ? zoned(startY, pa.mo, pa.d, 0, 0, 0, tz) : null;
  const end = zoned(endY, endMo, pb.d, 23, 59, 59, tz);
  return { start, end };
}

// ---------------------------------------------------------------- money
const FX_TO_INR = () => ({
  INR: 1,
  USD: Number(process.env.USD_TO_INR || 84),
  EUR: Number(process.env.EUR_TO_INR || 91),
  GBP: Number(process.env.GBP_TO_INR || 107),
  USDC: Number(process.env.USD_TO_INR || 84), // stablecoin prizes on Web3 platforms
  USDT: Number(process.env.USD_TO_INR || 84),
});
const SYMBOL = { $: 'USD', '₹': 'INR', '€': 'EUR', '£': 'GBP' };

function rupees(n) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(n % 1e7 ? 1 : 0)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(n % 1e5 ? 1 : 0)} L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
function formatMoney(amount, currency) {
  if (currency === 'INR') return rupees(amount);
  const sym = { USD: '$', EUR: '€', GBP: '£' }[currency];
  const n = Math.round(amount).toLocaleString('en-US');
  return sym ? `${sym}${n}` : `${n} ${currency}`;
}

// Parses "$10,000 in prizes", "₹1,00,000", "Rs. 50000", "INR 5 Lakhs", "₹5L", "$5K", "€2,000", "10000 USD",
// "1.5 Cr", "50k USDC". Numbers may be given directly with a currency. Returns null when there is no amount.
function parsePrize(input, defaultCurrency = 'USD') {
  if (input == null || input === '') return null;
  if (typeof input === 'number') {
    if (!(input > 0)) return null;
    const inr = Math.round(input * (FX_TO_INR()[defaultCurrency] || 1));
    return { amount: input, currency: defaultCurrency, inr, label: formatMoney(input, defaultCurrency) };
  }
  const text = String(input).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
  const re = /(\$|₹|€|£|\b(?:rs\.?|inr|usd|eur|gbp|usdc|usdt)(?![a-z]))?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|m|mn|l|lakhs?|lacs?|cr|crores?|million)?\b\s*(\b(?:inr|usd|eur|gbp|usdc|usdt)\b)?/gi;
  let best = null;
  for (const m of text.matchAll(re)) {
    const pre = (m[1] || '').toLowerCase().replace('.', '');
    const post = (m[4] || '').toUpperCase();
    const unit = (m[3] || '').toLowerCase();
    if (!pre && !post && !unit) continue; // a bare number ("Top 3", "2026") is not a prize
    let amount = Number(m[2].replace(/,/g, ''));
    if (!(amount > 0)) continue;
    if (unit === 'k') amount *= 1e3;
    else if (['m', 'mn', 'million'].includes(unit)) amount *= 1e6;
    else if (/^(l|lakh|lakhs|lac|lacs)$/.test(unit)) amount *= 1e5;
    else if (/^(cr|crore|crores)$/.test(unit)) amount *= 1e7;
    let currency = SYMBOL[pre] || (pre === 'rs' ? 'INR' : pre ? pre.toUpperCase() : '') || post;
    if (!currency) currency = /^(l|lakh|lakhs|lac|lacs|cr|crore|crores)$/.test(unit) ? 'INR' : defaultCurrency;
    const inr = Math.round(amount * (FX_TO_INR()[currency] || FX_TO_INR().USD));
    if (!best || inr > best.inr) best = { amount, currency, inr, label: formatMoney(amount, currency) };
  }
  return best;
}

// Decodes HTML entities (named, decimal and hex) that platforms leave in plain-text fields: &mdash; &amp; &#8217; &#x2014; ...
const NAMED = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", mdash: '—', ndash: '–', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', bull: '•', middot: '·', times: '×', copy: '©', reg: '®', trade: '™', euro: '€', pound: '£', yen: '¥', rupee: '₹', deg: '°', laquo: '«', raquo: '»', eacute: 'é', egrave: 'è', aacute: 'á', uuml: 'ü', ouml: 'ö', auml: 'ä', ntilde: 'ñ', ccedil: 'ç', shy: '' };
function decodeEntities(s) {
  return String(s ?? '').replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z][a-z0-9]{1,8});/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    const v = NAMED[e.toLowerCase()];
    return v === undefined ? m : v;
  });
}

const stripHtml = (s) => decodeEntities(String(s || '')
  .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]*>/g, ' ')
  )
  .replace(/\s+/g, ' ')
  .trim();

// Extracts schema.org Event objects from JSON-LD blocks in an HTML page (used by HTML-only sources).
function jsonLdEvents(html) {
  const out = [];
  for (const m of String(html).matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data;
    try { data = JSON.parse(m[1].trim()); } catch { continue; }
    const stack = Array.isArray(data) ? [...data] : [data];
    while (stack.length) {
      const x = stack.pop();
      if (!x || typeof x !== 'object') continue;
      if (Array.isArray(x)) { stack.push(...x); continue; }
      const t = [].concat(x['@type'] || []);
      if (t.some((v) => /Event$/i.test(v))) out.push(x);
      if (x['@graph']) stack.push(...[].concat(x['@graph']));
      if (x.itemListElement) stack.push(...[].concat(x.itemListElement).map((e) => e.item || e));
    }
  }
  return out;
}

// Next.js pages embed their props as JSON; returns the parsed object or null.
function nextData(html) {
  const m = String(html).match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

// Depth-first search for arrays of objects that look like events (have a name/title and some date field).
function findEventArrays(obj, { minLen = 1 } = {}) {
  const found = [];
  const seen = new Set();
  const walk = (x, depth) => {
    if (!x || typeof x !== 'object' || depth > 12 || seen.has(x)) return;
    seen.add(x);
    if (Array.isArray(x)) {
      if (x.length >= minLen && x.every((e) => e && typeof e === 'object' && !Array.isArray(e))
        && x.some((e) => (e.name || e.title) && Object.keys(e).some((k) => /(start|end|date|deadline)/i.test(k)))) found.push(x);
      for (const e of x) walk(e, depth + 1);
      return;
    }
    for (const v of Object.values(x)) walk(v, depth + 1);
  };
  walk(obj, 0);
  return found;
}

module.exports = { parseDate, parseDateRange, zoned, parsePrize, formatMoney, rupees, stripHtml, decodeEntities, jsonLdEvents, nextData, findEventArrays, MONTHS };

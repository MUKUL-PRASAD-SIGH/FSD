// Removes personal identifiers from free text before it is stored in any shared/aggregated form.
// Conservative on purpose: when in doubt, mask. Used for community "popular questions" and for crawled page text.
const PATTERNS = [
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]'],
  [/\bhttps?:\/\/\S+|\bwww\.\S+/gi, '[link]'],
  [/(?<![\w])@[a-z0-9_.]{2,30}\b/gi, '[handle]'],
  [/(?:\+?\d[\s().-]?){9,}/g, '[phone]'],
  [/\b\d{6,}\b/g, '[number]'],
];

function scrubPii(text, max = 160) {
  let t = String(text || '').replace(/\s+/g, ' ').trim();
  for (const [re, rep] of PATTERNS) t = t.replace(re, rep);
  return t.slice(0, max);
}

// A question is only shared with others if scrubbing removed nothing: any masked token means it may have been personal.
const containsPii = (text) => scrubPii(text, 10000) !== String(text || '').replace(/\s+/g, ' ').trim();

module.exports = { scrubPii, containsPii };

// Cross-source de-duplication. The same hackathon is often listed on Devfolio, Unstop and MLH, and the
// same Codeforces round appears on Codeforces and on aggregators. Two records are the same opportunity when:
//   (a) their canonical URLs are equal, or
//   (b) their normalised titles are equal AND their dates are close (start within 3 days, or deadline within 10).
// One record is kept as primary (native source over aggregator, then the more complete record);
// the others are attached to it as `alsoOn` so attribution is never lost and counts are never inflated.

// Lower number = preferred as the primary record
const SOURCE_PRIORITY = {
  manual: 0, devfolio: 1, devpost: 1, unstop: 1, mlh: 1, ethglobal: 1, dorahacks: 1, hackclub: 2, hackerearth: 2,
  kaggle: 1, codeforces: 1, codechef: 1, leetcode: 1, atcoder: 1, topcoder: 1, geeksforgeeks: 2, clist: 9,
};

function canonicalUrl(u) {
  try {
    const x = new URL(u);
    const host = x.hostname.toLowerCase().replace(/^www\./, '');
    for (const k of [...x.searchParams.keys()]) if (/^(utm_|ref$|ref_|source$|fbclid|gclid|lang$)/i.test(k)) x.searchParams.delete(k);
    const q = x.searchParams.toString();
    return `${host}${x.pathname.replace(/\/+$/, '').toLowerCase()}${q ? `?${q}` : ''}`;
  } catch { return ''; }
}

function titleKey(t) {
  return String(t || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(19|20)\d{2}\b|'\d{2}\b/g, ' ') // years: "HackMIT 2026", "Hack '26"
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|edition|season|official)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function completeness(it) {
  let s = 0;
  for (const k of ['organiser', 'description', 'city', 'prizeInr', 'registered', 'startDate', 'endDate']) if (it[k]) s++;
  s += Math.min(3, (it.eligibility || []).length) + Math.min(3, (it.tags || []).length);
  if (it.deadlineKind === 'registration') s += 2;
  return s;
}

const near = (a, b, days) => a && b && Math.abs(new Date(a) - new Date(b)) <= days * 86400000;

function sameOpportunity(a, b) {
  if (a.canon && a.canon === b.canon) return true;
  // Inside one feed, two different ids are two different events even when the titles match ("Weekly Quiz")
  if (a.source === b.source) return a.item.externalId === b.item.externalId;
  if (!a.tkey || a.tkey !== b.tkey || a.tkey.length < 4) return false;
  // When both sides know the start date it decides (different editions share names); otherwise compare deadlines
  if (a.item.startDate && b.item.startDate) return near(a.item.startDate, b.item.startDate, 3);
  return near(a.item.deadline, b.item.deadline, 10);
}

// entries: [{ source, item }] -> { kept: [{ source, item }], duplicates: [{ source, item, of: { source, externalId } }] }
function dedupe(entries) {
  const prepared = entries.map((e) => ({ ...e, canon: canonicalUrl(e.item.url), tkey: titleKey(e.item.title) }));
  prepared.sort((a, b) => (SOURCE_PRIORITY[a.source] ?? 5) - (SOURCE_PRIORITY[b.source] ?? 5) || completeness(b.item) - completeness(a.item));
  const kept = [];
  const duplicates = [];
  const byCanon = new Map();
  const byTitle = new Map();
  for (const e of prepared) {
    const candidates = [byCanon.get(e.canon), ...(byTitle.get(e.tkey) || [])].filter(Boolean);
    const primary = candidates.find((k) => sameOpportunity(k, e));
    if (primary) {
      if (primary.source === e.source && primary.item.externalId === e.item.externalId) continue; // exact repeat in one feed
      primary.item.alsoOn = primary.item.alsoOn || [];
      if (!primary.item.alsoOn.some((x) => x.source === e.source && x.url === e.item.url)) primary.item.alsoOn.push({ source: e.source, platform: e.item.platform, url: e.item.url });
      // Fill gaps in the primary from the duplicate rather than throwing information away
      for (const k of ['prizeInr', 'prizeLabel', 'prizeAmount', 'prizeCurrency', 'city', 'registered', 'organiser', 'description', 'startDate', 'endDate']) {
        if ((primary.item[k] == null || primary.item[k] === '' || primary.item[k] === 'See listing') && e.item[k] != null && e.item[k] !== '' && e.item[k] !== 'See listing') primary.item[k] = e.item[k];
      }
      for (const k of ['eligibility', 'tags', 'skills']) primary.item[k] = [...new Set([...(primary.item[k] || []), ...(e.item[k] || [])])].slice(0, 12);
      duplicates.push({ source: e.source, item: e.item, of: { source: primary.source, externalId: primary.item.externalId } });
      continue;
    }
    kept.push(e);
    if (e.canon) byCanon.set(e.canon, e);
    if (e.tkey) byTitle.set(e.tkey, [...(byTitle.get(e.tkey) || []), e]);
  }
  return { kept: kept.map(({ source, item }) => ({ source, item })), duplicates };
}

module.exports = { dedupe, canonicalUrl, titleKey, SOURCE_PRIORITY };

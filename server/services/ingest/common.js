// Shared helpers for source adapters. An adapter exports { name, fetchListings() } and returns
// normalised objects (see `normalise`). The runner upserts them keyed by (source, externalId).
const Listing = require('../../models/Listing');
const { extractSkills } = require('../skills');

const UA = 'Mozilla/5.0 (compatible; HackEliteBot/2.0; student project)';
const USD_TO_INR = Number(process.env.USD_TO_INR || 84);

async function getJson(url, { method = 'GET', body, headers = {}, retries = 1 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        body: body ? JSON.stringify(body) : undefined,
        headers: { Accept: 'application/json', 'User-Agent': UA, ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}`);
      return await res.json();
    } catch (e) {
      if (attempt >= retries) throw e;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

const stripHtml = (s) => (s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&amp;/g, ' ').replace(/\s+/g, ' ').trim();
const rupees = (n) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(1)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(n % 1e5 ? 1 : 0)} L` : `₹${n.toLocaleString('en-IN')}`);
const usdToInr = (usd) => Math.round(usd * USD_TO_INR);

// Fills in skills (from title + tags + blurb) so the recommender has signal even for thin listings.
function normalise(item) {
  const text = `${item.title} ${(item.tags || []).join(' ')} ${item.description || ''}`;
  const skills = [...new Set([...(item.skills || []), ...extractSkills(text).map((s) => s.name)])].slice(0, 12);
  return {
    organiser: '', description: '', city: '', mode: 'ONLINE', fee: 'Free', eligibility: [], tags: [], registered: null,
    prizeLabel: 'See listing', prizeInr: null,
    ...item,
    description: (item.description || '').slice(0, 600),
    tags: (item.tags || []).slice(0, 10),
    skills,
    externalId: String(item.externalId),
  };
}

// Only keep listings a person can still act on
const isOpen = (d) => d instanceof Date && !isNaN(d) && d.getTime() > Date.now();

async function upsertAll(source, items) {
  let n = 0;
  const seen = new Set();
  for (const raw of items) {
    if (!raw || !raw.title || !raw.url || !isOpen(raw.deadline)) continue;
    const it = normalise(raw);
    if (seen.has(it.externalId)) continue;
    seen.add(it.externalId);
    await Listing.updateOne({ source, externalId: it.externalId }, { $set: { ...it, source, refreshedAt: new Date() } }, { upsert: true });
    n++;
  }
  return n;
}

module.exports = { getJson, stripHtml, rupees, usdToInr, upsertAll, isOpen, normalise };

// Polite, bounded, same-site crawler for ONE event. Starting at the event's own URL it follows links to the organiser's
// official information pages (FAQ, rules, schedule, prizes, judging, eligibility, timeline, updates) and extracts:
//   - ordinary page passages, and
//   - published Q&A (schema.org FAQPage/QAPage, <details>/<summary>, <dt>/<dd>, "question?" headings)
//
// Legal / ethical guard rails (see docs/CRAWLER.md):
//   - public pages only: no logins, no CAPTCHA or bot-wall evasion (a 401/403/405 simply ends that page)
//   - robots.txt is honoured for every URL, including Crawl-Delay; our user agent identifies us
//   - same host only, max 6 extra pages, depth 1, >= 1 s between requests to a host, hard time and byte budgets
//   - participants' comments, discussion threads, profiles, galleries and project pages are NEVER fetched (personal data)
//   - emails, phone numbers and links are masked in extracted text
//   - nothing is fetched unless a signed-in user asks a question; results are cached so the site is not re-crawled
const cheerio = require('cheerio');
const { safeGet, robotsFor, validateUrl } = require('../utils/safeFetch');
const { scrubPii } = require('../utils/pii');

const MAX_EXTRA_PAGES = 6;
const MIN_GAP_MS = 1000;
const MAX_GAP_MS = 5000;
const TOTAL_BUDGET_MS = 40000;

const WANT = /\b(faq|faqs|frequently|questions?|q-?and-?a|qna|rules?|guidelines?|terms|eligib\w*|schedule|agenda|timeline|prizes?|rewards?|judging|criteria|tracks?|themes?|problem-?statements?|about|overview|details|updates?|announcements?|resources|requirements|how-?it-?works|register|registration)\b/i;
// personal-data / user-generated areas: never fetched
const NEVER = /(login|log-in|signin|sign-in|signup|sign-up|register\/?\?|account|profile|users?\/|participants?|attendees?|projects?|gallery|submissions?|forum|discussions?|comments?|community|members?|team\/|teams\/|chat|dm|inbox|messages?|cart|checkout|download|\.(pdf|zip|png|jpe?g|gif|svg|mp4|docx?|pptx?|xlsx?)(\?|$))/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (s) => String(s || '').replace(/\*\*|__|`+/g, '').replace(/\s+/g, ' ').trim();

function discoverLinks(html, base) {
  const $ = cheerio.load(html);
  const baseUrl = new URL(base);
  const found = new Map();
  $('a[href]').each((_, a) => {
    const href = ($(a).attr('href') || '').trim();
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) return;
    let u;
    try { u = new URL(href, baseUrl); } catch { return; }
    if (!['http:', 'https:'].includes(u.protocol) || u.host !== baseUrl.host) return;
    u.hash = '';
    const text = clean($(a).text()).slice(0, 80);
    const path = u.pathname + u.search;
    if (NEVER.test(path) || NEVER.test(text)) return;
    if (u.toString() === baseUrl.toString() || u.pathname === baseUrl.pathname && !u.search) return;
    const score = (WANT.test(path) ? 2 : 0) + (WANT.test(text) ? 1 : 0);
    if (!score) return;
    const key = u.toString();
    if (!found.has(key) || found.get(key).score < score) found.set(key, { url: key, text, score });
  });
  return [...found.values()].sort((a, b) => b.score - a.score).slice(0, MAX_EXTRA_PAGES);
}

// Organiser-published questions and answers
function extractFaq(html) {
  const $ = cheerio.load(html);
  const out = [];
  const add = (q, a) => { q = clean(q); a = clean(a); if (q.length >= 8 && q.length <= 240 && a.length >= 15) out.push({ question: q, answer: scrubPii(a, 700) }); };

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const walk = (n) => {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) return n.forEach(walk);
        const type = [].concat(n['@type'] || []).join(' ');
        if (/Question/i.test(type) && n.name) add(n.name, n.acceptedAnswer?.text || n.suggestedAnswer?.text || (Array.isArray(n.acceptedAnswer) ? n.acceptedAnswer[0]?.text : ''));
        Object.values(n).forEach(walk);
      };
      walk(JSON.parse($(el).contents().text()));
    } catch { /* ignore malformed JSON-LD */ }
  });
  $('details').each((_, d) => { const s = $(d).find('summary').first(); add(s.text(), $(d).clone().children('summary').remove().end().text()); });
  $('dl').each((_, dl) => { $(dl).find('dt').each((__, dt) => add($(dt).text(), $(dt).next('dd').text())); });
  $('h2,h3,h4,h5,strong,b').each((_, h) => {
    const q = clean($(h).text());
    if (!q.endsWith('?')) return;
    const parent = $(h).is('strong,b') ? $(h).parent() : $(h);
    let a = '';
    let n = parent.next();
    for (let i = 0; i < 3 && n.length && !/^h[1-6]$/i.test(n[0].tagName) && a.length < 600; i++, n = n.next()) a += ` ${n.text()}`;
    add(q, a);
  });
  const seen = new Set();
  return out.filter((f) => { const k = f.question.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 40);
}

// crawlEvent(startUrl, extractPage): returns { pages:[{url,title,ok,note}], passages:[{heading,text,url}], faq:[{question,answer,url}], ok, error? }
async function crawlEvent(startUrl, extractPage) {
  const t0 = Date.now();
  const pages = []; const passages = []; const faq = [];
  const lastHit = new Map();

  async function fetchOne(url) {
    const robots = await robotsFor(url);
    const u = new URL(url);
    if (!robots.allows(u.pathname + u.search)) return { ok: false, note: 'disallowed by robots.txt' };
    const gap = Math.min(MAX_GAP_MS, Math.max(MIN_GAP_MS, robots.crawlDelayMs));
    const wait = (lastHit.get(u.host) || 0) + gap - Date.now();
    if (wait > 0) await sleep(wait);
    lastHit.set(u.host, Date.now());
    const r = await safeGet(url);
    if (r.status < 200 || r.status >= 300) return { ok: false, note: `HTTP ${r.status}` };
    return { ok: true, body: r.body, finalUrl: r.finalUrl };
  }
  function ingest(url, body) {
    const x = extractPage(body);
    for (const p of x.passages) passages.push({ heading: p.heading, text: scrubPii(p.text, 700), url });
    for (const f of extractFaq(body)) faq.push({ ...f, url });
    return x;
  }

  validateUrl(startUrl);
  const seed = await fetchOne(startUrl).catch((e) => ({ ok: false, note: e.message }));
  if (!seed.ok) return { ok: false, error: seed.note, pages: [{ url: startUrl, ok: false, note: seed.note }], passages: [], faq: [] };
  const x = ingest(startUrl, seed.body);
  pages.push({ url: startUrl, title: x.title, ok: true });
  const seedJsOnly = x.jsOnly;

  for (const link of discoverLinks(seed.body, seed.finalUrl || startUrl)) {
    if (Date.now() - t0 > TOTAL_BUDGET_MS) { pages.push({ url: link.url, ok: false, note: 'time budget reached' }); break; }
    try {
      const r = await fetchOne(link.url);
      if (!r.ok) { pages.push({ url: link.url, ok: false, note: r.note }); continue; }
      const px = ingest(link.url, r.body);
      pages.push({ url: link.url, title: px.title || link.text, ok: true });
    } catch (e) { pages.push({ url: link.url, ok: false, note: e.message }); }
  }
  return { ok: true, jsOnly: seedJsOnly && passages.length < 6, pages, passages: passages.slice(0, 160), faq: faq.slice(0, 60) };
}

module.exports = { crawlEvent, discoverLinks, extractFaq };

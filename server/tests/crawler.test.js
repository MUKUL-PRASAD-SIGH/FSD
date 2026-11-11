// Multi-page event crawler + anonymous question aggregation: legal guard rails and privacy.
process.env.NODE_ENV = 'test';
process.env.MONGO_DB_NAME = 'hackelite_crawler_test';
process.env.JWT_SECRET = process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32 ? process.env.JWT_SECRET : 'crawler-test-secret-crawler-test-secret-0123456789';
process.env.ADMIN_EMAIL = ''; process.env.ADMIN_PASSWORD = '';
process.env.GEMINI_API_KEY = ''; process.env.SMTP_URL = ''; process.env.GOOGLE_CLIENT_ID = '';
process.env.DISABLE_INGEST = 'true'; process.env.EMBEDDINGS_PROVIDER = 'local';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const { discoverLinks, extractFaq } = require('../services/siteCrawler');
const { scrubPii, containsPii } = require('../utils/pii');
const { crawlDelayOf } = require('../utils/safeFetch');
const { keyOf } = require('../services/communityQuestions');

// ------------------------------------------------------------------ units
test('discoverLinks follows official info pages on the same host and never personal-data areas', () => {
  const html = `<a href="/faq">FAQ</a><a href="/rules">Rules</a><a href="/schedule">Schedule</a><a href="/prizes">Prizes</a>
    <a href="/forum/topic/1">Forum</a><a href="/participants">Participants</a><a href="/projects/xyz">Projects</a><a href="/users/jane">Jane</a>
    <a href="/login">Sign in</a><a href="https://other.example/faq">External FAQ</a><a href="/brochure.pdf">Brochure about rules</a><a href="mailto:a@b.co">Contact</a><a href="#top">Top</a><a href="/comments">Comments about rules</a>`;
  const got = discoverLinks(html, 'http://hack.test/event').map((l) => new URL(l.url).pathname).sort();
  assert.deepEqual(got, ['/faq', '/prizes', '/rules', '/schedule']);
});

test('extractFaq reads JSON-LD FAQPage, <details>, <dl> and question headings', () => {
  const html = `<script type="application/ld+json">{"@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Can beginners join the hackathon?","acceptedAnswer":{"@type":"Answer","text":"Yes, beginners are very welcome and mentors will help."}}]}</script>
    <details><summary>Is there a participation fee?</summary>No, participation is completely free for everyone.</details>
    <dl><dt>What is the maximum team size?</dt><dd>Teams can have up to four members each.</dd></dl>
    <h3>Do I need to bring a laptop?</h3><p>Yes, please bring your own laptop and charger for the weekend.</p>`;
  const qs = extractFaq(html).map((f) => f.question).sort();
  assert.deepEqual(qs, ['Can beginners join the hackathon?', 'Do I need to bring a laptop?', 'Is there a participation fee?', 'What is the maximum team size?']);
});

test('scrubPii masks emails, phones, links, handles and long numbers; containsPii detects them', () => {
  const t = scrubPii('Mail me at jane.doe@gmail.com or call +91 98765 43210, see https://x.example/p and @jane_dev id 12345678');
  assert.doesNotMatch(t, /jane|98765|x\.example|12345678/);
  assert.match(t, /\[email\].*\[phone\].*\[link\].*\[handle\].*\[number\]/);
  assert.equal(containsPii('Who can participate in the finals?'), false);
  assert.equal(containsPii('email me at a@b.co'), true);
});

test('crawlDelayOf prefers our agent, then *', () => {
  assert.equal(crawlDelayOf('User-agent: *\nCrawl-delay: 3\n'), 3000);
  assert.equal(crawlDelayOf('User-agent: *\nCrawl-delay: 3\nUser-agent: HackEliteBot\nCrawl-delay: 7\n'), 7000);
  assert.equal(crawlDelayOf('User-agent: *\nDisallow: /x\n'), 0);
});

test('question keys ignore word order, case and filler words', () => {
  assert.equal(keyOf('Who can participate?'), keyOf('can participate who'));
  assert.equal(keyOf('What is the team size?'), keyOf('team size?'));
  assert.notEqual(keyOf('What is the prize?'), keyOf('What is the deadline?'));
});

// ------------------------------------------------------------------ end to end
const Listing = require('../models/Listing');
const User = require('../models/User');
const UserQuery = require('../models/UserQuery');
const ListingQuestion = require('../models/ListingQuestion');
const connectDB = require('../config/db');
const { buildApp, migrate } = require('../server');

let server; let base; let site; let siteBase; const hits = [];
const PW = 'Str0ng-Passw0rd!9';
const SITE = {
  '/robots.txt': 'User-agent: *\nDisallow: /secret\nCrawl-delay: 0\n',
  '/event': `<html><head><title>MegaHack</title></head><body><nav><a href="/faq">FAQ</a> <a href="/rules">Rules</a> <a href="/secret/plans">Rules draft</a> <a href="/forum/1">Forum</a> <a href="/participants">Participants</a> <a href="https://elsewhere.example/faq">FAQ elsewhere</a></nav>
    <main><h1>MegaHack</h1><p>MegaHack is a weekend build marathon for students. Contact the organiser at team@megahack.example or call +91 98765 43210 for help with registration.</p></main></body></html>`,
  '/faq': `<html><body><main><h1>FAQ</h1><details><summary>Can first-year students participate?</summary>Yes, first-year students from any college are welcome to join MegaHack.</details></main></body></html>`,
  '/rules': '<html><body><main><h1>Rules</h1><p>Every project must be started from scratch during the weekend and judged on originality and impact.</p></main></body></html>',
  '/secret/plans': '<html><body><main><p>SECRET-ROBOTS-DISALLOWED content that must never be crawled.</p></main></body></html>',
  '/forum/1': '<html><body><main><p>FORUM-COMMENT by jane about her private plans that must never be crawled.</p></main></body></html>',
  '/participants': '<html><body><main><p>PARTICIPANT-LIST of people that must never be crawled.</p></main></body></html>',
};
test.before(async () => {
  site = http.createServer((req, res) => {
    hits.push({ url: req.url, t: Date.now() });
    const body = SITE[req.url];
    if (!body) { res.writeHead(404); return res.end('nope'); }
    res.writeHead(200, { 'Content-Type': req.url === '/robots.txt' ? 'text/plain' : 'text/html' }); res.end(body);
  });
  await new Promise((r) => site.listen(0, '127.0.0.1', r));
  siteBase = `http://127.0.0.1:${site.address().port}`;
  await connectDB(); await mongoose.connection.dropDatabase(); await migrate();
  server = buildApp().listen(0); base = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); server.close(); site.close(); });

const call = async (method, path, { token, body } = {}) => {
  const h = {}; if (token) h.Authorization = `Bearer ${token}`; if (body) h['Content-Type'] = 'application/json';
  const r = await fetch(base + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
let n = 0;
const reg = async (over = {}) => { const r = await call('POST', '/api/auth/register', { body: { name: 'Crawler Tester', email: `c${Date.now()}${n++}@example.com`, password: PW, ...over } }); return { token: r.body.token, id: r.body.user.id, email: r.body.user.email }; };
const withLoopback = (fn) => async () => { process.env.ALLOW_PRIVATE_FETCH = '127.0.0.1'; try { await fn(); } finally { delete process.env.ALLOW_PRIVATE_FETCH; } };
const ask = (token, id, question) => call('POST', `/api/listings/${id}/ask`, { token, body: { question } });

test('the crawler reads official sub-pages and FAQ, cites them, and never touches robots-blocked, forum or participant pages', withLoopback(async () => {
  const l = await Listing.create({ title: 'MegaHack', type: 'HACKATHON', url: `${siteBase}/event`, source: 'manual', platform: 'Manual', mode: 'ONLINE', fee: 'Free', deadline: new Date(Date.now() + 5 * 86400000) });
  const u = await reg();
  hits.length = 0;
  const r = await ask(u.token, l._id, 'Can first-year students participate?');
  assert.equal(r.status, 200);
  assert.match(r.body.answer, /first-year students/i);
  const faqSource = r.body.sources.find((s) => s.from === 'faq');
  assert.ok(faqSource && faqSource.url.endsWith('/faq'), 'the answer cites the FAQ page URL');
  assert.ok(r.body.page.pagesRead >= 3 && r.body.page.faqFound >= 1);

  const fetched = hits.map((h) => h.url);
  for (const banned of ['/secret/plans', '/forum/1', '/participants']) assert.ok(!fetched.includes(banned), `${banned} must not be requested`);
  assert.ok(fetched.includes('/robots.txt') && fetched.includes('/faq') && fetched.includes('/rules'));
  const pageHits = hits.filter((h) => h.url !== '/robots.txt').map((h) => h.t);
  for (let i = 1; i < pageHits.length; i++) assert.ok(pageHits[i] - pageHits[i - 1] >= 900, 'at least ~1 s between requests to the same host');

  const stored = JSON.stringify(await mongoose.connection.collection('listingpages').findOne({ listing: l._id }));
  assert.doesNotMatch(stored, /team@megahack\.example|98765|SECRET-ROBOTS|FORUM-COMMENT|PARTICIPANT-LIST/, 'emails/phones are masked and blocked pages never stored');
  assert.match(stored, /\[email\]/);

  const again = hits.length;
  await ask(u.token, l._id, 'What are the project rules?');
  assert.equal(hits.length, again, 'second question is served from the cache, no re-crawl');
}));

test('community questions are anonymous, scrubbed, opt-out aware and only shown once asked twice', async () => {
  const l = await Listing.create({ title: 'Anon Hack', type: 'HACKATHON', url: `${siteBase}/rules`, source: 'manual', platform: 'Manual', mode: 'ONLINE', fee: 'Free', deadline: new Date(Date.now() + 5 * 86400000) });
  process.env.ALLOW_PRIVATE_FETCH = '127.0.0.1';
  try {
    const a = await reg(); const b = await reg(); const c = await reg();
    await ask(a.token, l._id, 'Who can participate in the finals?');
    let pop = await call('GET', `/api/listings/${l._id}/questions`, { token: b.token });
    assert.equal(pop.body.popular.length, 0, 'asked once: not shown to others');
    await ask(b.token, l._id, 'finals: can participate who');
    pop = await call('GET', `/api/listings/${l._id}/questions`, { token: c.token });
    assert.equal(pop.body.popular.length, 1); assert.equal(pop.body.popular[0].count, 2);

    const pii = await ask(c.token, l._id, 'Please email me at jane.doe@gmail.com about the finals');
    assert.equal(pii.body.sharedAnonymously, false, 'a question with personal data is not shared');
    await call('PUT', '/api/me/profile', { token: c.token, body: { privacy: { shareQuestions: false } } });
    const off = await ask(c.token, l._id, 'Who can participate in the finals?');
    assert.equal(off.body.sharedAnonymously, false, 'opted-out users are not counted');
    assert.equal((await call('GET', `/api/listings/${l._id}/questions`, { token: c.token })).body.popular[0].count, 2);

    const docs = await ListingQuestion.find({ listing: l._id }).lean();
    assert.ok(docs.length >= 1 && docs.every((d) => !('user' in d) && !('ip' in d)), 'no user identifier on aggregated questions');
    assert.doesNotMatch(JSON.stringify(docs), /jane|gmail/);
    assert.equal(await call('GET', `/api/listings/${l._id}/questions`).then((r) => r.status), 401, 'sign-in required');
  } finally { delete process.env.ALLOW_PRIVATE_FETCH; }
});

test('your question history is private, deletable and removed with the account', async () => {
  const l = await Listing.create({ title: 'Hist Hack', type: 'HACKATHON', url: `${siteBase}/rules`, source: 'manual', platform: 'Manual', mode: 'ONLINE', fee: 'Free', deadline: new Date(Date.now() + 5 * 86400000) });
  process.env.ALLOW_PRIVATE_FETCH = '127.0.0.1';
  try {
    const a = await reg(); const b = await reg();
    await ask(a.token, l._id, 'my private question about the venue');
    const mine = await call('GET', `/api/listings/${l._id}/ask/history`, { token: a.token });
    assert.equal(mine.body.items.length, 1);
    assert.equal((await call('GET', `/api/listings/${l._id}/ask/history`, { token: b.token })).body.items.length, 0, "another user can't see it");
    await call('DELETE', `/api/listings/${l._id}/ask/history`, { token: b.token });
    assert.equal((await call('GET', `/api/listings/${l._id}/ask/history`, { token: a.token })).body.items.length, 1, "someone else's delete does not touch mine");
    await call('DELETE', `/api/listings/${l._id}/ask/history`, { token: a.token });
    assert.equal((await call('GET', `/api/listings/${l._id}/ask/history`, { token: a.token })).body.items.length, 0);

    await ask(a.token, l._id, 'another private question here');
    assert.equal(await UserQuery.countDocuments({ user: a.id }), 1);
    assert.equal((await call('DELETE', '/api/auth/me', { token: a.token, body: { password: PW } })).status, 200);
    assert.equal(await UserQuery.countDocuments({ user: a.id }), 0, 'account deletion removes query history');
  } finally { delete process.env.ALLOW_PRIVATE_FETCH; }
});

test('organisers see aggregated, anonymous questions about their own event only', async () => {
  const owner = await reg({ accountType: 'lister', organisation: 'Org One', website: 'https://org.example', reason: 'We run hackathons for students every year.' });
  const other = await reg({ accountType: 'lister', organisation: 'Org Two', website: 'https://org2.example', reason: 'We also run hackathons for students.' });
  const plain = await reg();
  const ownerDoc = await User.findOne({ email: owner.email });
  const l = await Listing.create({ title: 'Org Hack', type: 'HACKATHON', url: `${siteBase}/rules`, source: 'manual', platform: 'Manual', mode: 'ONLINE', fee: 'Free', deadline: new Date(Date.now() + 5 * 86400000), createdBy: ownerDoc._id });
  process.env.ALLOW_PRIVATE_FETCH = '127.0.0.1';
  try {
    const asker = await reg();
    await ask(asker.token, l._id, 'Is accommodation provided for outstation teams?');
    const ok = await call('GET', `/api/lister/listings/${l._id}/questions`, { token: owner.token });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.questions[0].count, 1);
    assert.doesNotMatch(JSON.stringify(ok.body), new RegExp(asker.email.split('@')[0]), 'no asker identity in the organiser view');
    assert.equal((await call('GET', `/api/lister/listings/${l._id}/questions`, { token: other.token })).status, 404, "another organiser can't see it");
    assert.equal((await call('GET', `/api/lister/listings/${l._id}/questions`, { token: plain.token })).status, 403, 'plain users are refused');
  } finally { delete process.env.ALLOW_PRIVATE_FETCH; }
});

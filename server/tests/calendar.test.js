// Calendar integration: RFC 5545 output, add-to-calendar links, and the personalised secret-token feed.
process.env.NODE_ENV = 'test';
process.env.MONGO_DB_NAME = 'hackelite_calendar_test';
process.env.JWT_SECRET = process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32 ? process.env.JWT_SECRET : 'calendar-test-secret-calendar-test-secret-0123456789';
process.env.ADMIN_EMAIL = ''; process.env.ADMIN_PASSWORD = '';
process.env.GEMINI_API_KEY = ''; process.env.SMTP_URL = ''; process.env.GOOGLE_CLIENT_ID = '';
process.env.DISABLE_INGEST = 'true'; process.env.EMBEDDINGS_PROVIDER = 'local';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const cal = require('../services/calendar');

const DAY = 86400000;
const L = (over = {}) => ({
  _id: '6af4a1a3e3f449b3545851ae', title: 'Corporate Clash – Jadavpur, Kolkata (Ünïcode; with, commas)', platform: 'Unstop', organiser: 'JU', url: 'https://unstop.com/x',
  deadline: new Date(Date.now() + 3 * DAY), startDate: new Date(Date.now() + 10 * DAY), endDate: new Date(Date.now() + 11 * DAY), mode: 'OFFLINE', city: 'Kolkata', fee: 'Free', updatedAt: new Date(), ...over,
});

// ------------------------------------------------------------------ units
test('fold: lines never exceed 75 octets, continuation lines start with a space, multi-byte characters are never split', () => {
  const long = `SUMMARY:${'Ünïcödé 🚀 '.repeat(40)}`;
  const folded = cal.fold(long);
  for (const line of folded.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, `${Buffer.byteLength(line)} octets`);
  assert.ok(folded.split('\r\n').slice(1).every((l) => l.startsWith(' ')));
  assert.equal(folded.replace(/\r\n /g, ''), long, 'unfolding restores the original text');
  assert.equal(cal.fold('SUMMARY:short'), 'SUMMARY:short');
});

test('esc escapes backslash, semicolon, comma and newlines; utc formats basic UTC time', () => {
  assert.equal(cal.esc('a;b,c\\d\ne'), 'a\\;b\\,c\\\\d\\ne');
  assert.equal(cal.utc(new Date('2026-11-14T04:30:00.000Z')), '20261114T043000Z');
});

test('eventsFor makes a deadline event and an event-dates event with stable UIDs and the requested reminders', () => {
  const ics = cal.buildCalendar({ name: 'T', events: cal.eventsFor(L(), { reminders: [4320, 60], status: 'applied' }) });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/); assert.match(ics, /END:VCALENDAR\r\n$/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.match(ics, /UID:deadline-6af4a1a3e3f449b3545851ae@hackelite/); assert.match(ics, /UID:event-6af4a1a3e3f449b3545851ae@hackelite/);
  assert.match(ics, /TRIGGER:-PT4320M/); assert.match(ics, /TRIGGER:-PT60M/);
  assert.match(ics.replace(/\r\n /g, ''), /Your status: applied\./);
  assert.match(ics, /X-WR-CALNAME:T/); assert.match(ics, /REFRESH-INTERVAL;VALUE=DURATION:PT60M/);
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
  const again = cal.buildCalendar({ name: 'T', events: cal.eventsFor(L(), { reminders: [60] }) });
  assert.equal(again.match(/UID:[^\r]+/g)[0], ics.match(/UID:[^\r]+/g)[0], 'UIDs are stable across rebuilds so calendars update instead of duplicating');
});

test('past deadlines and past events produce no events; picks are labelled', () => {
  assert.equal(cal.eventsFor(L({ deadline: new Date(Date.now() - DAY), startDate: null, endDate: null })).length, 0);
  const one = cal.eventsFor(L({ startDate: null, endDate: null }), { pick: 82 });
  assert.equal(one.length, 1);
  assert.match(one[0].join('\r\n').replace(/\r\n /g, ''), /Recommended for you \(82% match\)/);
});

test('cleanReminders keeps only supported values, newest-first, max three, default one day', () => {
  assert.deepEqual(cal.cleanReminders([60, 1440, 7, 99999, 10080, 4320]), [10080, 4320, 1440]);
  assert.deepEqual(cal.cleanReminders([]), [1440]); assert.deepEqual(cal.cleanReminders(['x']), [1440]);
});

test('links builds Google and Outlook add-event URLs with encoded title, UTC dates and location', () => {
  const k = cal.links(L());
  assert.match(k.deadline.google, /^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE&text=/);
  assert.match(k.deadline.google, /dates=\d{8}T\d{6}Z\/\d{8}T\d{6}Z/);
  assert.match(k.deadline.outlook, /^https:\/\/outlook\.live\.com\/calendar\/0\/deeplink\/compose/);
  assert.match(k.deadline.office365, /^https:\/\/outlook\.office\.com\//);
  assert.ok(k.event, 'event dates link exists when the event has not started');
  assert.equal(cal.links(L({ startDate: null, endDate: null })).event, undefined);
});

// ------------------------------------------------------------------ end to end
const Listing = require('../models/Listing');
const User = require('../models/User');
const connectDB = require('../config/db');
const { buildApp, migrate } = require('../server');
let server; let base; let n = 0;
const PW = 'Str0ng-Passw0rd!9';

test.before(async () => { await connectDB(); await mongoose.connection.dropDatabase(); await migrate(); server = buildApp().listen(0); base = `http://127.0.0.1:${server.address().port}`; });
test.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); server.close(); });

const call = async (method, path, { token, body, raw } = {}) => {
  const h = {}; if (token) h.Authorization = `Bearer ${token}`; if (body) h['Content-Type'] = 'application/json';
  const r = await fetch(path.startsWith('http') ? path : base + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json; try { json = JSON.parse(text); } catch { json = null; }
  return { status: r.status, body: json, text, headers: r.headers };
};
const reg = async (name) => { const r = await call('POST', '/api/auth/register', { body: { name, email: `cal${Date.now()}${n++}@example.com`, password: PW } }); return { token: r.body.token, id: r.body.user.id, email: r.body.user.email }; };
const mk = (title, over = {}) => Listing.create({ title, type: 'HACKATHON', url: `https://x.example/${title.replace(/\W/g, '')}`, source: 'manual', platform: 'Manual', mode: 'OFFLINE', city: 'Pune', fee: 'Free', skills: ['Python', 'NLP'], deadline: new Date(Date.now() + 5 * DAY), startDate: new Date(Date.now() + 12 * DAY), endDate: new Date(Date.now() + 13 * DAY), ...over });
const unfold = (s) => s.replace(/\r\n /g, '');
const feedPath = (url) => url.replace(/^https?:\/\/[^/]+/, '');

test('per-user live feed: secret token, personal events and reminders, picks opt-in, rotate and revoke', async () => {
  const [a, b] = [await reg('Alice Calendar'), await reg('Bob Calendar')];
  const l1 = await mk('Alice Saved Hack'); const l2 = await mk('Bob Saved Hack'); const l3 = await mk('Pick Candidate Hack');

  assert.equal((await call('GET', '/api/calendar/settings')).status, 401);
  const s0 = await call('GET', '/api/calendar/settings', { token: a.token });
  assert.equal(s0.body.enabled, false); assert.equal(s0.body.feedUrl, null); assert.deepEqual(s0.body.reminders, [1440]);
  assert.match(s0.headers.get('cache-control'), /no-store/);

  await call('PUT', `/api/me/saved/${l1._id}`, { token: a.token, body: { status: 'applied' } });
  await call('PUT', `/api/me/saved/${l2._id}`, { token: b.token, body: { status: 'saved' } });

  const t = await call('POST', '/api/calendar/token', { token: a.token });
  assert.equal(t.status, 201); assert.match(t.body.feedUrl, /\/api\/calendar\/feed\/[a-f0-9]{48}\.ics$/); assert.match(t.body.webcalUrl, /^webcal:/);
  const feedA = feedPath(t.body.feedUrl);

  // the feed needs NO login (calendar apps cannot send one) but only the token
  const f = await call('GET', feedA);
  assert.equal(f.status, 200); assert.match(f.headers.get('content-type'), /text\/calendar/);
  assert.match(f.headers.get('cache-control'), /private, max-age=900/);
  const ics = unfold(f.text);
  assert.match(ics, /Alice Saved Hack/); assert.match(ics, /Your status: applied/); assert.match(ics, /TRIGGER:-PT1440M/);
  assert.doesNotMatch(ics, /Bob Saved Hack|Pick Candidate Hack/, "another user's tracker and un-opted picks are not in the feed");
  for (const line of f.text.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);

  // personalised reminders
  assert.equal((await call('PUT', '/api/calendar/settings', { token: a.token, body: { reminders: [7] } })).status, 400);
  assert.equal((await call('PUT', '/api/calendar/settings', { token: a.token, body: { reminders: [60, 4320] } })).status, 200);
  const f2 = unfold((await call('GET', feedA)).text);
  assert.match(f2, /TRIGGER:-PT4320M/); assert.match(f2, /TRIGGER:-PT60M/); assert.doesNotMatch(f2, /TRIGGER:-PT1440M/);

  // picks are opt-in and labelled
  await call('PUT', '/api/me/profile', { token: a.token, body: { skills: ['Python', 'NLP'], interests: ['AI/ML'], notify: { minMatch: 0 } } });
  assert.doesNotMatch(unfold((await call('GET', feedA)).text), /Pick Candidate Hack/);
  await call('PUT', '/api/calendar/settings', { token: a.token, body: { includePicks: true } });
  const withPicks = unfold((await call('GET', feedA)).text);
  assert.match(withPicks, /Pick Candidate Hack/); assert.match(withPicks, /Recommended for you \(\d+% match\)/);

  // the token is never exposed through other endpoints
  const me = await call('GET', '/api/auth/me', { token: a.token });
  const secret = t.body.feedUrl.match(/feed\/([a-f0-9]{48})/)[1];
  assert.ok(!JSON.stringify(me.body).includes(secret), 'token not in /auth/me');
  assert.ok(!(await User.findById(a.id)).toJSON?.().calendar?.token, 'token is select:false');

  // Bob has his own feed and sees none of Alice's data
  const tb = await call('POST', '/api/calendar/token', { token: b.token });
  const bobFeed = unfold((await call('GET', feedPath(tb.body.feedUrl))).text);
  assert.match(bobFeed, /Bob Saved Hack/); assert.doesNotMatch(bobFeed, /Alice Saved Hack/);

  // rotate: the old URL dies immediately, the new one works
  const t2 = await call('POST', '/api/calendar/token', { token: a.token });
  assert.notEqual(t2.body.feedUrl, t.body.feedUrl);
  assert.equal((await call('GET', feedA)).status, 404, 'old token revoked on rotate');
  assert.equal((await call('GET', feedPath(t2.body.feedUrl))).status, 200);

  // malformed / unknown tokens are indistinguishable 404s; disabled accounts get nothing; revoke works
  assert.equal((await call('GET', '/api/calendar/feed/short.ics')).status, 404);
  assert.equal((await call('GET', `/api/calendar/feed/${'0'.repeat(48)}.ics`)).status, 404);
  await User.updateOne({ _id: b.id }, { status: 'disabled' });
  assert.equal((await call('GET', feedPath(tb.body.feedUrl))).status, 404, 'disabled account feed is off');
  assert.equal((await call('DELETE', '/api/calendar/token', { token: a.token })).status, 200);
  assert.equal((await call('GET', feedPath(t2.body.feedUrl))).status, 404, 'revoked');
  assert.equal((await call('GET', '/api/calendar/settings', { token: a.token })).body.enabled, false);
});

test('single-event download is personalised and needs sign-in; link endpoint is public; closed events are gone', async () => {
  const u = await reg('Carol Calendar');
  const open = await mk('Carol Open Hack');
  await call('PUT', `/api/me/saved/${open._id}`, { token: u.token, body: { status: 'shortlisted' } });
  await call('PUT', '/api/calendar/settings', { token: u.token, body: { reminders: [180] } });

  assert.equal((await call('GET', `/api/calendar/event/${open._id}.ics`)).status, 401);
  const r = await call('GET', `/api/calendar/event/${open._id}.ics`, { token: u.token });
  assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /text\/calendar/); assert.match(r.headers.get('cache-control'), /no-store/);
  const ics = unfold(r.text);
  assert.match(ics, /TRIGGER:-PT180M/); assert.match(ics, /Your status: shortlisted/); assert.match(ics, /Carol Open Hack/);

  const closed = await mk('Closed Hack', { deadline: new Date(Date.now() - DAY), startDate: null, endDate: null });
  assert.equal((await call('GET', `/api/calendar/event/${closed._id}.ics`, { token: u.token })).status, 410);
  assert.equal((await call('GET', '/api/calendar/event/nope.ics', { token: u.token })).status, 404);

  const links = await call('GET', `/api/calendar/links/${open._id}`);
  assert.equal(links.status, 200); assert.match(links.body.deadline.google, /calendar\.google\.com/); assert.ok(links.body.event);
  assert.equal((await call('GET', `/api/calendar/links/${closed._id}`)).status, 200, 'links still build for any published listing');

  const pub = await call('GET', '/api/listings/calendar.ics');
  assert.equal(pub.status, 200); assert.match(pub.text, /^BEGIN:VCALENDAR/);
  for (const line of pub.text.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, 'the generic public feed is folded too');
});

test('the feed token is indexed (unique + sparse) so each poll is a single index lookup', async () => {
  await User.init();
  const idx = (await User.collection.indexes()).find((i) => i.key && i.key['calendar.token'] === 1);
  assert.ok(idx, 'index on calendar.token exists');
  assert.equal(idx.unique, true); assert.equal(idx.sparse, true);
  const explain = await User.collection.find({ 'calendar.token': 'a'.repeat(48) }).explain('queryPlanner');
  assert.match(JSON.stringify(explain.queryPlanner.winningPlan), /IXSCAN/, 'token lookup uses the index, not a collection scan');
});

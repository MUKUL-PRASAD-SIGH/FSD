// Launch-mode behaviour: everything free, admins by verified email, the college directory, onboarding gaps,
// listing quality flags and user reports, and the admin review queue. Real HTTP against a real MongoDB.
process.env.NODE_ENV = 'test';
process.env.MONGO_DB_NAME = 'hackelite_platform_test';
process.env.JWT_SECRET = process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32 ? process.env.JWT_SECRET : 'platform-test-secret-platform-test-secret-0123';
process.env.PLANS_ENABLED = 'false';
process.env.ADMIN_EMAIL = ''; process.env.ADMIN_PASSWORD = '';
process.env.ADMIN_EMAILS = 'boss@example.com';
process.env.GEMINI_API_KEY = ''; process.env.SMTP_URL = ''; process.env.GOOGLE_CLIENT_ID = '';
process.env.DISABLE_INGEST = 'true'; process.env.EMBEDDINGS_PROVIDER = 'local'; process.env.HIBP_CHECK = 'off';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { buildApp, migrate } = require('../server');
const User = require('../models/User');
const Listing = require('../models/Listing');
const College = require('../models/College');
const Notification = require('../models/Notification');
const quality = require('../services/listingQuality');
const colleges = require('../services/colleges');

const PW = 'Str0ng-Passw0rd!9';
const DAY = 86400000;
let server; let base; let n = 0;

test.before(async () => {
  await connectDB(); await mongoose.connection.dropDatabase(); await migrate();
  server = buildApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); server.close(); });

const call = async (method, p, { token, body } = {}) => {
  const h = {}; if (token) h.Authorization = `Bearer ${token}`; if (body) h['Content-Type'] = 'application/json';
  const r = await fetch(base + p, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* empty */ }
  return { status: r.status, body: json };
};
const register = async (name, email = `p${Date.now()}${n++}@example.com`) => {
  const r = await call('POST', '/api/auth/register', { body: { name, email, password: PW } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { token: r.body.token, id: r.body.user.id, email, name, user: r.body.user };
};
const login = (email) => call('POST', '/api/auth/login', { body: { email, password: PW } });
const mkListing = (title, over = {}) => Listing.create({ title, type: 'HACKATHON', url: `https://x.example/${title.replace(/\W/g, '')}`, source: 'manual', platform: 'Manual', mode: 'ONLINE', fee: 'Free', organiser: 'Org', description: 'A long enough description of this event for the quality checks.', prizeInr: 50000, deadline: new Date(Date.now() + 14 * DAY), ...over });

let admin; let alice; let bob;

test('free for everyone: a brand-new account has every feature and nothing to buy', async () => {
  alice = await register('Alice Rao');
  assert.equal(alice.user.plan.unlocked, true);
  assert.equal((await call('GET', '/api/auth/config')).body.plansEnabled, false);
  const chat = await call('POST', '/api/assistant/chat', { token: alice.token, body: { question: 'online AI hackathons for beginners' } });
  assert.equal(chat.status, 200, 'the assistant is not behind a paywall');
  const room = await call('POST', '/api/chat/rooms', { token: alice.token, body: { name: 'Crew', invite: [] } });
  assert.equal(room.status, 201, 'private rooms are not behind a paywall');
  assert.equal((await call('POST', '/api/plan/activate', { token: alice.token, body: { key: 'x' } })).status, 409);
  assert.equal((await call('GET', '/api/plan', { token: alice.token })).body.unlocked, true);
});

test('admin by email: only after the email is verified', async () => {
  const b = await register('Big Boss', 'boss@example.com');
  assert.equal(b.user.role, 'user', 'registering an admin address does not make you admin');
  let r = await login('boss@example.com');
  assert.equal(r.body.user.role, 'user', 'still not admin while the email is unverified');
  await User.updateOne({ email: 'boss@example.com' }, { $set: { emailVerified: true } });
  r = await login('boss@example.com');
  assert.equal(r.body.user.role, 'admin', 'promoted on the first verified sign-in');
  admin = { token: r.body.token, id: r.body.user.id };
  assert.equal((await call('GET', '/api/admin/stats', { token: admin.token })).status, 200);
  const other = await register('Not Boss');
  await User.updateOne({ _id: other.id }, { $set: { emailVerified: true } });
  assert.equal((await login(other.email)).body.user.role, 'user');
  assert.ok(await mongoose.connection.collection('auditlogs').findOne({ action: 'auth.admin_promoted' }));
});

test('colleges: Bengaluru seed, aliases, canonical names, user additions visible to the next person, junk refused', async () => {
  assert.ok(await College.countDocuments({ source: 'seed' }) >= 90);
  const s = await call('GET', '/api/colleges?q=rvce');
  assert.equal(s.status, 200);
  assert.match(s.body.colleges[0].name, /R V College of Engineering/);
  assert.equal(colleges.key('R.V. College of Engg., Bangalore'), colleges.key('rv college of engineering'));

  // typing an alias stores the official name
  let r = await call('PUT', '/api/me/profile', { token: alice.token, body: { college: 'PESU' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.college, 'PES University');
  assert.equal((await College.findOne({ name: 'PES University' })).users, 1);

  // a missing college is added, shown to the next user, and flagged to admins
  bob = await register('Bob Nair');
  r = await call('PUT', '/api/me/profile', { token: bob.token, body: { college: 'Sunrise Institute of Robotics' } });
  assert.equal(r.status, 200);
  const added = await College.findOne({ name: 'Sunrise Institute of Robotics' }).lean();
  assert.equal(added.source, 'user'); assert.equal(added.reviewed, false);
  const next = await call('GET', '/api/colleges?q=sunrise');
  assert.equal(next.body.colleges[0].name, 'Sunrise Institute of Robotics');
  await new Promise((res) => setTimeout(res, 100));
  assert.ok(await Notification.findOne({ user: admin.id, type: 'admin_review', title: /New college/ }), 'admins are alerted');
  // switching college moves the count
  await call('PUT', '/api/me/profile', { token: alice.token, body: { college: 'Christ University' } });
  assert.equal((await College.findOne({ name: 'PES University' })).users, 0);

  for (const junk of ['ab', 'https://spam.example', 'buy now @ me.com', '12345']) {
    const j = await call('PUT', '/api/me/profile', { token: bob.token, body: { college: junk } });
    assert.equal(j.status, 400, `rejects ${junk}`);
  }
  for (let i = 0; i < 2; i++) await call('PUT', '/api/me/profile', { token: bob.token, body: { college: `New Valley College ${i + 1}` } });
  const capped = await call('PUT', '/api/me/profile', { token: bob.token, body: { college: 'Yet Another Valley College' } });
  assert.equal(capped.status, 400, 'at most 3 new colleges per person per day');
});

test('admin college review: rename, merge into the official name (profiles follow), hide', async () => {
  const q = await call('GET', '/api/admin/review', { token: admin.token });
  assert.ok(q.body.colleges.some((c) => c.name === 'Sunrise Institute of Robotics'));
  const added = await College.findOne({ name: 'Sunrise Institute of Robotics' });
  let r = await call('PATCH', `/api/admin/colleges/${added._id}`, { token: admin.token, body: { action: 'rename', name: 'Sunrise Institute of Robotics and AI' } });
  assert.equal(r.status, 200);
  assert.equal((await User.findById(bob.id)).college, 'New Valley College 2', 'other profiles untouched');
  const v1 = await College.findOne({ name: 'New Valley College 1' });
  const rvce = await College.findOne({ name: /R V College of Engineering/ });
  r = await call('PATCH', `/api/admin/colleges/${v1._id}`, { token: admin.token, body: { action: 'merge', into: String(rvce._id) } });
  assert.equal(r.status, 200);
  assert.equal(await College.countDocuments({ _id: v1._id }), 0);
  // the merged spelling now resolves to the official college
  const again = await call('PUT', '/api/me/profile', { token: bob.token, body: { college: 'New Valley College 1' } });
  assert.match(again.body.user.college, /R V College of Engineering/);
  const v2 = await College.findOne({ name: 'New Valley College 2' });
  await call('PATCH', `/api/admin/colleges/${v2._id}`, { token: admin.token, body: { action: 'hide' } });
  const left = (await call('GET', '/api/colleges?q=new valley')).body.colleges.map((x) => x.name);
  assert.ok(!left.includes('New Valley College 2'), 'hidden colleges leave the dropdown');
  assert.ok(left.some((x) => /R V College of Engineering/.test(x)), 'the merged spelling is now an alias of the official college');
  assert.equal((await call('PATCH', `/api/admin/colleges/${v2._id}`, { token: alice.token, body: { action: 'approve' } })).status, 403);
});

test('onboarding: asks only for what the recommender is missing; partial saves never wipe other preferences', async () => {
  const fresh = await register('Chitra Menon');
  let g = (await call('GET', '/api/me/onboarding', { token: fresh.token })).body;
  assert.equal(g.completeness, 0);
  assert.deepEqual(g.missing.map((m) => m.field).sort(), ['city', 'college', 'education', 'gradYear', 'interests', 'modes', 'skills', 'types']);
  await call('PUT', '/api/me/profile', { token: fresh.token, body: { preferences: { modes: ['ONLINE'], types: ['HACKATHON'] } } });
  await call('PUT', '/api/me/profile', { token: fresh.token, body: { location: { city: 'Bengaluru' }, preferences: { willingToTravel: true } } });
  const u = await User.findById(fresh.id).lean();
  assert.deepEqual(u.preferences.modes, ['ONLINE'], 'modes survive a partial preferences update');
  assert.equal(u.preferences.willingToTravel, true);
  await call('PUT', '/api/me/profile', { token: fresh.token, body: { skills: ['Python', 'React', 'SQL'], interests: ['AI/ML'], education: { level: 'undergraduate', gradYear: 2027 }, college: 'BMSCE', onboarding: { goals: ['win prizes', 'not-a-goal'], complete: true } } });
  g = (await call('GET', '/api/me/onboarding', { token: fresh.token })).body;
  assert.equal(g.completeness, 100);
  assert.deepEqual(g.missing, []);
  assert.equal(g.done, true);
  assert.deepEqual(g.goals, ['win prizes'], 'unknown goals are dropped');
});

test('listing quality: confusing listings are flagged, users see what to double-check', async () => {
  const clean = await mkListing('Clean Build Weekend');
  const messy = await mkListing('Messy Event Listing', { mode: 'OFFLINE', city: '', organiser: '', fee: '', prizeInr: null, prizeLabel: 'See listing', startDate: new Date(Date.now() + 20 * DAY), endDate: new Date(Date.now() + 10 * DAY), inferred: ['deadline from event end'] });
  const r = await quality.scanOpen();
  assert.ok(r.flagged >= 1);
  const m = await Listing.findById(messy._id).lean();
  for (const c of ['dates_inconsistent', 'deadline_inferred', 'offline_no_city', 'no_organiser', 'prize_unclear', 'fee_unclear']) assert.ok(m.quality.issues.includes(c), c);
  assert.deepEqual((await Listing.findById(clean._id).lean()).quality.issues, []);
  const shown = await call('GET', `/api/listings/${messy._id}`);
  assert.ok(shown.body.listing.verify.some((v) => /dates/i.test(v)));
  assert.deepEqual((await call('GET', `/api/listings/${clean._id}`)).body.listing.verify, []);
  const q = await call('GET', '/api/admin/review', { token: admin.token });
  assert.ok(q.body.listings.some((l) => l.title === 'Messy Event Listing'));
  assert.equal((await call('POST', `/api/admin/review/listings/${messy._id}/ok`, { token: admin.token })).status, 200);
  assert.ok(!(await call('GET', '/api/admin/review', { token: admin.token })).body.listings.some((l) => l.title === 'Messy Event Listing'), '"looks fine" clears it from the queue');
});

test('reports: a user reports a listing, admins are alerted, duplicates are ignored, resolving clears the flag', async () => {
  const l = await mkListing('Reported Hackathon');
  assert.equal((await call('POST', `/api/listings/${l._id}/report`, { body: { reason: 'wrong_dates' } })).status, 401);
  assert.equal((await call('POST', `/api/listings/${l._id}/report`, { token: alice.token, body: { reason: 'nonsense' } })).status, 400);
  let r = await call('POST', `/api/listings/${l._id}/report`, { token: alice.token, body: { reason: 'wrong_dates', note: 'The site says the 20th' } });
  assert.equal(r.status, 201);
  r = await call('POST', `/api/listings/${l._id}/report`, { token: alice.token, body: { reason: 'wrong_dates' } });
  assert.equal(r.body.already, true);
  assert.ok((await Listing.findById(l._id).lean()).quality.issues.includes('reported'));
  await new Promise((res) => setTimeout(res, 100));
  assert.ok(await Notification.findOne({ user: admin.id, type: 'admin_review', title: /reported/ }));
  const q = await call('GET', '/api/admin/review', { token: admin.token });
  const rep = q.body.reports.find((x) => x.listing.title === 'Reported Hackathon');
  assert.equal(rep.note, 'The site says the 20th');
  assert.equal((await call('POST', `/api/admin/review/reports/${rep.id}`, { token: alice.token, body: { action: 'resolve' } })).status, 403);
  assert.equal((await call('POST', `/api/admin/review/reports/${rep.id}`, { token: admin.token, body: { action: 'resolve' } })).status, 200);
  const after = await Listing.findById(l._id).lean();
  assert.equal(after.quality.reports, 0);
  assert.ok(!after.quality.issues.includes('reported'));
});

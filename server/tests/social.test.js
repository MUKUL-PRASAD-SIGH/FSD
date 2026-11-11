// Network, chat, teams, invites, reminders: real HTTP + real Socket.IO clients against a real MongoDB.
process.env.NODE_ENV = 'test';
process.env.MONGO_DB_NAME = 'hackelite_social_test';
process.env.JWT_SECRET = process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32 ? process.env.JWT_SECRET : 'social-test-secret-social-test-secret-0123456789';
process.env.ADMIN_EMAIL = ''; process.env.ADMIN_PASSWORD = '';
process.env.GEMINI_API_KEY = ''; process.env.SMTP_URL = ''; process.env.GOOGLE_CLIENT_ID = '';
process.env.DISABLE_INGEST = 'true'; process.env.EMBEDDINGS_PROVIDER = 'local'; process.env.PRO_ACTIVATION_KEYS = 'SOCIAL-PRO-KEY';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { io: ioc } = require('socket.io-client');
const jwt = require('jsonwebtoken');

const connectDB = require('../config/db');
const { buildApp, migrate } = require('../server');
const realtime = require('../services/realtime');
const { outbox } = require('../services/mailer');
const { runReminders } = require('../services/reminders');
const User = require('../models/User');
const Listing = require('../models/Listing');
const Saved = require('../models/Saved');
const Room = require('../models/Room');
const Message = require('../models/Message');
const Connection = require('../models/Connection');
const Team = require('../models/Team');
const Invite = require('../models/Invite');
const Notification = require('../models/Notification');

const PW = 'Str0ng-Passw0rd!9';
const DAY = 86400000;
let server; let base; let n = 0;
const sockets = [];

test.before(async () => {
  await connectDB(); await mongoose.connection.dropDatabase(); await migrate();
  server = buildApp().listen(0); realtime.init(server);
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => {
  for (const s of sockets) s.close();
  await realtime.close(); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); server.close();
});

const call = async (method, path, { token, body } = {}) => {
  const h = {}; if (token) h.Authorization = `Bearer ${token}`; if (body) h['Content-Type'] = 'application/json';
  const r = await fetch(base + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, body: json, text, headers: r.headers };
};
const mkUser = async (name, { pro = false, discoverable = false, verified = true, skills = [] } = {}) => {
  const r = await call('POST', '/api/auth/register', { body: { name, email: `s${Date.now()}${n++}@example.com`, password: PW } });
  const u = { token: r.body.token, id: r.body.user.id, email: r.body.user.email, name };
  const set = { emailVerified: verified };
  if (pro) set['plan.tier'] = 'pro';
  await User.updateOne({ _id: u.id }, { $set: { ...set, 'social.discoverable': discoverable, skills } });
  return u;
};
const connect = (token) => new Promise((resolve, reject) => {
  const s = ioc(base, { auth: { token }, transports: ['websocket'], reconnection: false });
  sockets.push(s);
  s.on('ready', () => resolve(s)); s.on('connect_error', (e) => reject(e));
});
const waitFor = (s, ev, ms = 3000) => new Promise((resolve, reject) => { const t = setTimeout(() => reject(new Error(`no "${ev}" within ${ms}ms`)), ms); s.once(ev, (p) => { clearTimeout(t); resolve(p); }); });
const emitAck = (s, ev, p) => new Promise((resolve) => s.emit(ev, p, resolve));
const befriend = async (a, b) => {
  await call('POST', '/api/network/requests', { token: a.token, body: { userId: b.id } });
  const ov = await call('GET', '/api/network/overview', { token: b.token });
  const req = ov.body.incoming.find((x) => x.id === a.id);
  assert.ok(req, 'incoming request visible');
  assert.equal((await call('POST', `/api/network/requests/${req.requestId}/accept`, { token: b.token })).status, 200);
};
const mkListing = (title, over = {}) => Listing.create({ title, type: 'HACKATHON', url: `https://x.example/${title.replace(/\W/g, '')}`, source: 'manual', platform: 'Manual', mode: 'ONLINE', fee: 'Free', skills: ['Python'], deadline: new Date(Date.now() + 14 * DAY), ...over });

// =====================================================================================================================
test('connections: opt-in discovery, generic email requests, accept/decline, mutual auto-accept, block, caps; nothing private leaks', async () => {
  const [a, b, c] = [await mkUser('Alice Net'), await mkUser('Bob Net', { discoverable: true }), await mkUser('Carol Hidden')];

  // free name search only finds people who opted in
  const found = await call('GET', '/api/network/people?q=Net', { token: a.token });
  assert.deepEqual(found.body.people.map((p) => p.name), ['Bob Net'], 'only the discoverable person');
  assert.equal(found.body.smart, false);
  assert.ok(!/@example\.com/.test(found.text), 'no email addresses in search results');
  assert.equal((await call('GET', '/api/network/people?q=Carol', { token: a.token })).body.people.length, 0, 'non-discoverable users never appear');

  // by email: identical answer for a real and a made-up address (no account enumeration)
  const real = await call('POST', '/api/network/requests', { token: a.token, body: { email: c.email } });
  const fake = await call('POST', '/api/network/requests', { token: a.token, body: { email: 'nobody-here@example.com' } });
  assert.equal(real.status, 200); assert.deepEqual(real.body, fake.body);
  // ... and Carol did receive it
  const ovC = await call('GET', '/api/network/overview', { token: c.token });
  assert.equal(ovC.body.incoming.length, 1);

  // request, duplicate is idempotent, then accept
  assert.equal((await call('POST', '/api/network/requests', { token: a.token, body: { userId: b.id } })).body.status, 'pending');
  assert.equal((await call('POST', '/api/network/requests', { token: a.token, body: { userId: b.id } })).body.status, 'pending');
  assert.equal(await Connection.countDocuments({ pair: Connection.pairKey(a.id, b.id) }), 1, 'one document per pair');
  const reqB = (await call('GET', '/api/network/overview', { token: b.token })).body.incoming[0];
  assert.equal((await call('POST', `/api/network/requests/${reqB.requestId}/accept`, { token: a.token })).status, 404, 'only the recipient can accept');
  assert.equal((await call('POST', `/api/network/requests/${reqB.requestId}/accept`, { token: b.token })).status, 200);
  const ovA = await call('GET', '/api/network/overview', { token: a.token });
  assert.deepEqual(ovA.body.connections.map((x) => x.name), ['Bob Net']);
  assert.match(ovA.headers.get('cache-control'), /no-store/);

  // Carol declines; Alice can ask again later
  await call('POST', `/api/network/requests/${ovC.body.incoming[0].requestId}/decline`, { token: c.token });
  assert.equal((await call('POST', '/api/network/requests', { token: a.token, body: { userId: c.id } })).body.status, 'pending');

  // both ask each other => connected immediately
  const [d, e] = [await mkUser('Dan Net'), await mkUser('Eve Net')];
  await call('POST', '/api/network/requests', { token: d.token, body: { userId: e.id } });
  assert.equal((await call('POST', '/api/network/requests', { token: e.token, body: { userId: d.id } })).body.status, 'accepted');

  // blocking: no requests, no DMs, removed from connections, invisible in search
  await call('POST', '/api/network/block', { token: b.token, body: { userId: a.id } });
  assert.equal((await call('POST', '/api/network/requests', { token: a.token, body: { userId: b.id } })).status, 403);
  assert.equal((await call('POST', '/api/chat/rooms/dm', { token: a.token, body: { userId: b.id } })).status, 403);
  assert.equal((await call('GET', '/api/network/overview', { token: a.token })).body.connections.length, 0);
  assert.equal((await call('GET', '/api/network/blocked', { token: b.token })).body.blocked[0].name, 'Alice Net');
  await call('DELETE', `/api/network/block/${a.id}`, { token: b.token });
  assert.equal((await call('POST', '/api/network/requests', { token: a.token, body: { userId: b.id } })).body.status, 'pending', 'after unblock a fresh request is possible');

  // self-connection and daily cap
  assert.equal((await call('POST', '/api/network/requests', { token: a.token, body: { userId: a.id } })).status, 400);
  const f = await mkUser('Spammy');
  await Connection.insertMany(Array.from({ length: 50 }, (_, i) => ({ pair: `cap_${f.id}_${i}`, requester: f.id, recipient: new mongoose.Types.ObjectId() })));
  assert.equal((await call('POST', '/api/network/requests', { token: f.token, body: { userId: a.id } })).status, 429, 'daily request cap');
});

test('notifications: connection requests arrive live over the socket, in-app, and by email only to verified opted-in users', async () => {
  const a = await mkUser('Nia Notify'); const b = await mkUser('Ben Notify', { verified: true }); const u = await mkUser('Una Unverified', { verified: false });
  const sb = await connect(b.token);
  outbox.length = 0;
  const live = waitFor(sb, 'notification:new');
  await call('POST', '/api/network/requests', { token: a.token, body: { userId: b.id } });
  const pushed = await live;
  assert.equal(pushed.type, 'connection_request'); assert.match(pushed.title, /Nia Notify wants to connect/);
  const list = await call('GET', '/api/me/notifications', { token: b.token });
  assert.ok(list.body.notifications.some((x) => x.type === 'connection_request'));
  assert.ok(outbox.some((m) => m.to === b.email && /wants to connect/.test(m.subject)), 'verified user gets an email');

  outbox.length = 0;
  await call('POST', '/api/network/requests', { token: a.token, body: { userId: u.id } });
  assert.equal(outbox.filter((m) => m.to === u.email).length, 0, 'never email an unverified address');
  assert.equal(await Notification.countDocuments({ user: u.id, type: 'connection_request' }), 1, 'the in-app notification still exists');

  await call('PUT', '/api/me/profile', { token: b.token, body: { notify: { emailSocial: false } } });
  outbox.length = 0;
  const c = await mkUser('Cam Notify');
  await call('POST', '/api/network/requests', { token: c.token, body: { userId: b.id } });
  assert.equal(outbox.filter((m) => m.to === b.email).length, 0, 'opted-out users get no email');
});

// =====================================================================================================================
test('chat: live DMs between connections, history, unread counts, membership-only access, limits and block', async () => {
  const [a, b, c] = [await mkUser('Ana Chat'), await mkUser('Bo Chat'), await mkUser('Cy Outsider')];
  assert.equal((await call('POST', '/api/chat/rooms/dm', { token: a.token, body: { userId: b.id } })).status, 403, 'must be connected first');
  await befriend(a, b);
  const dm = (await call('POST', '/api/chat/rooms/dm', { token: a.token, body: { userId: b.id } })).body.roomId;
  assert.equal((await call('POST', '/api/chat/rooms/dm', { token: b.token, body: { userId: a.id } })).body.roomId, dm, 'one DM room per pair');

  const [sa, sb, sc] = [await connect(a.token), await connect(b.token), await connect(c.token)];
  const gotB = waitFor(sb, 'message:new'); const noC = waitFor(sc, 'message:new', 600).then(() => 'leaked', () => 'ok');
  const ack = await emitAck(sa, 'message:send', { roomId: dm, text: 'Hello Bo <script>alert(1)</script>' });
  assert.equal(ack.ok, true);
  const m = await gotB;
  assert.equal(m.text, 'Hello Bo <script>alert(1)</script>', 'stored verbatim (the UI renders text, never HTML)');
  assert.equal(m.senderName, 'Ana Chat');
  assert.equal(await noC, 'ok', 'an outsider socket receives nothing');

  // unread/read
  let rooms = (await call('GET', '/api/chat/rooms', { token: b.token })).body;
  assert.equal(rooms.unread, 1); assert.equal(rooms.rooms[0].name, 'Ana Chat'); assert.equal(rooms.rooms[0].unread, 1);
  assert.equal((await call('GET', '/api/chat/rooms', { token: a.token })).body.unread, 0, 'my own messages are never unread');
  await emitAck(sb, 'room:read', { roomId: dm });
  assert.equal((await call('GET', '/api/chat/rooms', { token: b.token })).body.unread, 0);

  // REST send + history + paging
  assert.equal((await call('POST', `/api/chat/rooms/${dm}/messages`, { token: b.token, body: { text: 'hi from REST' } })).status, 201);
  for (let i = 0; i < 5; i++) await call('POST', `/api/chat/rooms/${dm}/messages`, { token: a.token, body: { text: `m${i}` } });
  const hist = await call('GET', `/api/chat/rooms/${dm}/messages?limit=3`, { token: a.token });
  assert.deepEqual(hist.body.messages.map((x) => x.text), ['m2', 'm3', 'm4'], 'newest page, oldest first');
  const older = await call('GET', `/api/chat/rooms/${dm}/messages?limit=3&before=${encodeURIComponent(hist.body.messages[0].createdAt)}`, { token: a.token });
  assert.ok(older.body.messages.length === 3 && older.body.messages.at(-1).text === 'm1');

  // outsiders: identical 404 for "not yours" and "does not exist"; cannot read, send, read-mark or invite
  const ghost = new mongoose.Types.ObjectId();
  for (const [method, p, body] of [['GET', `/api/chat/rooms/${dm}/messages`], ['POST', `/api/chat/rooms/${dm}/messages`, { text: 'x' }], ['POST', `/api/chat/rooms/${dm}/read`], ['GET', `/api/chat/rooms/${dm}`], ['GET', `/api/chat/rooms/${ghost}/messages`]]) {
    const r = await call(method, p, { token: c.token, body }); assert.equal(r.status, 404, `${method} ${p}`);
  }
  assert.equal((await emitAck(sc, 'message:send', { roomId: dm, text: 'let me in' })).ok, false);
  assert.equal((await emitAck(sa, 'message:send', { roomId: 'not-an-id', text: 'x' })).ok, false);

  // validation
  assert.equal((await call('POST', `/api/chat/rooms/${dm}/messages`, { token: a.token, body: { text: '   ' } })).status, 400);
  assert.equal((await call('POST', `/api/chat/rooms/${dm}/messages`, { token: a.token, body: { text: 'x'.repeat(2001) } })).status, 400);

  // typing only reaches room members
  const typing = waitFor(sb, 'typing'); const typingC = waitFor(sc, 'typing', 500).then(() => 'leaked', () => 'ok');
  sa.emit('typing', { roomId: dm, on: true });
  assert.equal((await typing).userId, a.id); assert.equal(await typingC, 'ok');

  // socket rate limit (20 per 10 s)
  let refused = 0; for (let i = 0; i < 30; i++) { const r = await emitAck(sa, 'message:send', { roomId: dm, text: `flood ${i}` }); if (!r.ok && /too fast/i.test(r.error)) refused += 1; }
  assert.ok(refused >= 5, `flooding is throttled (refused ${refused})`);

  // blocking ends messaging immediately
  await call('POST', '/api/network/block', { token: b.token, body: { userId: a.id } });
  const blocked = await call('POST', `/api/chat/rooms/${dm}/messages`, { token: a.token, body: { text: 'still there?' } });
  assert.equal(blocked.status, 403);
});

test('sockets: only valid, current JWTs connect; revoked sessions are dropped', async () => {
  const a = await mkUser('Sock Auth');
  const attempt = (auth) => new Promise((resolve) => { const s = ioc(base, { auth, transports: ['websocket'], reconnection: false }); sockets.push(s); s.on('ready', () => resolve('connected')); s.on('connect_error', (e) => resolve(e.message)); });
  assert.equal(await attempt({}), 'unauthorized');
  assert.equal(await attempt({ token: 'garbage' }), 'unauthorized');
  assert.equal(await attempt({ token: Buffer.from(JSON.stringify({ id: a.id, email: a.email })).toString('base64') }), 'unauthorized', 'unsigned base64 tokens are refused');
  assert.equal(await attempt({ token: jwt.sign({ id: a.id, tv: 0 }, 'wrong-secret-wrong-secret-wrong-secret!!') }), 'unauthorized', 'wrong signing key');
  assert.equal(await attempt({ token: jwt.sign({ id: a.id, tv: 0 }, process.env.JWT_SECRET, { algorithm: 'HS512' }) }), 'unauthorized', 'only HS256');
  assert.equal(await attempt({ token: 'test-token' }), 'unauthorized', 'no test-token backdoor');
  const s = await connect(a.token);
  const dropped = new Promise((r) => s.on('disconnect', r));
  assert.equal((await call('POST', '/api/auth/change-password', { token: a.token, body: { current: PW, password: 'N3w-Str0ng-Passw0rd!x' } })).status, 200);
  await Promise.race([dropped, new Promise((_, rej) => setTimeout(() => rej(new Error('socket was not dropped after the password change')), 3000))]);
  assert.equal(await attempt({ token: a.token }), 'unauthorized', 'the old token no longer connects');
});

// =====================================================================================================================
test('private rooms: invite-only, connections only, owner controls, live membership changes', async () => {
  const [o, m, stranger] = [await mkUser('Olga Owner', { pro: true }), await mkUser('Max Member'), await mkUser('Sam Stranger')];
  await befriend(o, m);
  const freeTry = await call('POST', '/api/chat/rooms', { token: m.token, body: { name: 'Free room' } });
  assert.equal(freeTry.status, 402); assert.equal(freeTry.body.code, 'PRO_REQUIRED', 'creating a private room is Pro');
  const made = await call('POST', '/api/chat/rooms', { token: o.token, body: { name: 'Study hall', invite: [m.id, stranger.id] } });
  assert.equal(made.status, 201);
  const room = made.body.roomId;
  assert.equal((await call('POST', '/api/chat/rooms', { token: o.token, body: { name: 'x' } })).status, 400);

  const inv = (await call('GET', '/api/network/overview', { token: m.token })).body.invites.incoming.find((i) => i.kind === 'room_invite');
  assert.ok(inv && inv.room.name === 'Study hall');
  assert.equal((await call('GET', '/api/network/overview', { token: stranger.token })).body.invites.incoming.length, 0, 'strangers (not connected) cannot be invited');
  assert.equal((await call('GET', `/api/chat/rooms/${room}/messages`, { token: m.token })).status, 404, 'invited but not joined: no access');

  const sm = await connect(m.token);
  const added = waitFor(sm, 'room:added');
  assert.equal((await call('POST', `/api/network/invites/${inv.id}/accept`, { token: m.token })).status, 200);
  assert.equal((await added).roomId, room);
  const live = waitFor(sm, 'message:new');
  await call('POST', `/api/chat/rooms/${room}/messages`, { token: o.token, body: { text: 'welcome' } });
  assert.equal((await live).text, 'welcome', 'a freshly joined member receives live messages without reconnecting');
  assert.equal((await call('GET', `/api/chat/rooms/${room}`, { token: m.token })).body.room.members.length, 2);

  assert.equal((await call('POST', `/api/chat/rooms/${room}/invite`, { token: m.token, body: { userId: stranger.id } })).status, 402, 'a free member cannot invite others (hosting is Pro)');
  assert.equal((await call('POST', `/api/chat/rooms/${room}/leave`, { token: o.token })).status, 400, 'owner cannot leave');
  assert.equal((await call('DELETE', `/api/chat/rooms/${room}`, { token: m.token })).status, 403);
  const removed = waitFor(sm, 'room:removed');
  assert.equal((await call('POST', `/api/chat/rooms/${room}/leave`, { token: m.token })).status, 200);
  await removed;
  assert.equal((await call('GET', `/api/chat/rooms/${room}/messages`, { token: m.token })).status, 404, 'leaving revokes access');
  assert.equal((await call('DELETE', `/api/chat/rooms/${room}`, { token: o.token })).status, 200);
  assert.equal(await Message.countDocuments({ room }), 0, 'deleting a room deletes its messages');
});

// =====================================================================================================================
test('teams: invite by email (generic), accept joins team + room + tracker, capacity, ownership, disband', async () => {
  const [owner, guest, third] = [await mkUser('Tia Owner', { pro: true }), await mkUser('Gus Guest'), await mkUser('Thea Third')];
  const listing = await mkListing('Team Hack 2026');
  const created = await call('POST', '/api/teams', { token: owner.token, body: { name: 'Pixel Pirates', listingId: String(listing._id), maxMembers: 2, lookingFor: ['react'] } });
  assert.equal(created.status, 201);
  const team = created.body.team;
  assert.equal(team.members.length, 1); assert.ok(team.room);
  assert.ok(await Saved.exists({ user: owner.id, listing: listing._id }), 'the owner tracks the hackathon');
  assert.equal((await call('POST', '/api/teams', { token: guest.token, body: { name: 'Free try' } })).body.code, 'PRO_REQUIRED', 'a free user cannot create a team (but can join one by invitation, below)');
  assert.equal((await call('POST', '/api/teams', { token: owner.token, body: { name: 'x' } })).status, 400);

  // invite by email: same answer for a stranger address
  outbox.length = 0;
  const a1 = await call('POST', `/api/teams/${team.id}/invite`, { token: owner.token, body: { email: guest.email, message: 'Join us!' } });
  const a2 = await call('POST', `/api/teams/${team.id}/invite`, { token: owner.token, body: { email: 'ghost-person@example.com' } });
  assert.deepEqual(a1.body, a2.body);
  assert.ok(outbox.some((m) => m.to === guest.email && /invited you to join/.test(m.subject)), 'invite email to the registered, verified person');
  assert.equal(outbox.filter((m) => m.to === 'ghost-person@example.com').length, 0, 'nothing is sent to unregistered addresses');
  await call('POST', `/api/teams/${team.id}/invite`, { token: owner.token, body: { email: guest.email } }); // duplicate: idempotent
  assert.equal(await Invite.countDocuments({ team: team.id, to: guest.id, status: 'pending' }), 1);
  assert.equal((await call('POST', `/api/teams/${team.id}/invite`, { token: guest.token, body: { email: third.email } })).status, 404, 'non-members cannot invite');

  const sg = await connect(guest.token);
  const inv = (await call('GET', '/api/network/overview', { token: guest.token })).body.invites.incoming[0];
  assert.equal(inv.kind, 'team_invite'); assert.equal(inv.team.name, 'Pixel Pirates');
  assert.equal((await call('POST', `/api/network/invites/${inv.id}/accept`, { token: owner.token })).status, 404, 'only the invitee can accept');
  assert.equal((await call('POST', `/api/network/invites/${inv.id}/accept`, { token: guest.token })).status, 200);
  assert.ok(await Saved.exists({ user: guest.id, listing: listing._id }), 'accepting saves the hackathon in the invitee tracker');
  const live = waitFor(sg, 'message:new');
  await call('POST', `/api/chat/rooms/${team.room}/messages`, { token: owner.token, body: { text: 'team room is live' } });
  assert.equal((await live).text, 'team room is live', 'invitee receives the team room live');
  assert.equal((await call('GET', `/api/teams/${team.id}`, { token: guest.token })).body.team.members.length, 2);
  assert.equal((await call('GET', `/api/teams/${team.id}`, { token: third.token })).status, 404, 'non-members cannot even see a private team');

  // capacity (max 2)
  await call('POST', `/api/teams/${team.id}/invite`, { token: owner.token, body: { email: third.email } }).then((r) => assert.equal(r.status, 409, 'full team: no more invites'));

  // member management
  assert.equal((await call('PUT', `/api/teams/${team.id}`, { token: guest.token, body: { name: 'Hijack' } })).status, 403);
  assert.equal((await call('PUT', `/api/teams/${team.id}`, { token: owner.token, body: { maxMembers: 1 } })).status, 400, 'cannot shrink below members');
  assert.equal((await call('PUT', `/api/teams/${team.id}`, { token: owner.token, body: { maxMembers: 3, name: 'Pixel Pirates 2' } })).status, 200);
  assert.equal((await call('POST', `/api/teams/${team.id}/leave`, { token: owner.token })).status, 400, 'owner cannot leave');
  assert.equal((await call('POST', `/api/teams/${team.id}/transfer`, { token: owner.token, body: { userId: guest.id } })).status, 200);
  assert.equal((await call('GET', `/api/teams/${team.id}`, { token: owner.token })).body.team.isOwner, false);
  assert.equal((await call('DELETE', `/api/teams/${team.id}/members/${guest.id}`, { token: guest.token })).status, 400, 'the current owner can never be removed');
  assert.equal((await call('POST', `/api/teams/${team.id}/leave`, { token: owner.token })).status, 200);
  assert.equal((await call('GET', `/api/chat/rooms/${team.room}/messages`, { token: owner.token })).status, 404, 'leaving removes team room access');
  assert.equal((await call('DELETE', `/api/teams/${team.id}`, { token: guest.token })).status, 200, 'new owner disbands');
  assert.equal(await Room.countDocuments({ _id: team.room }), 0); assert.equal(await Message.countDocuments({ room: team.room }), 0);
});

test('tracker share: one call finds or creates the team for a tracked hackathon and invites a registered person', async () => {
  const [a, b] = [await mkUser('Sharer Sue', { pro: true }), await mkUser('Shared Sid')];
  const l = await mkListing('Share Hack');
  assert.equal((await call('POST', '/api/teams/share', { token: b.token, body: { listingId: String(l._id), email: a.email } })).status, 402, 'sharing from the tracker (and creating the team room) is Pro');
  assert.equal((await call('POST', '/api/teams/share', { token: a.token, body: { listingId: String(l._id), email: b.email } })).status, 400, 'must be in the tracker first');
  const reg = await call('POST', `/api/me/saved/${l._id}/registered`, { token: a.token });
  assert.equal(reg.body.saved.status, 'applied', 'clicking Register tracks it as applied');
  await call('PUT', `/api/me/saved/${l._id}`, { token: a.token, body: { status: 'shortlisted' } });
  assert.equal((await call('POST', `/api/me/saved/${l._id}/registered`, { token: a.token })).body.saved.status, 'shortlisted', 'never downgrades a later stage');

  const s1 = await call('POST', '/api/teams/share', { token: a.token, body: { listingId: String(l._id), email: b.email, message: 'Want to team up?' } });
  assert.equal(s1.status, 200); assert.ok(s1.body.teamId);
  const s2 = await call('POST', '/api/teams/share', { token: a.token, body: { listingId: String(l._id), email: b.email } });
  assert.equal(s2.body.teamId, s1.body.teamId, 'the same team is reused, not duplicated');
  assert.equal(await Team.countDocuments({ owner: a.id, listing: l._id }), 1);
  const inv = (await call('GET', '/api/network/overview', { token: b.token })).body.invites.incoming[0];
  assert.match(inv.team.name, /Share Hack/);
  await call('POST', `/api/network/invites/${inv.id}/accept`, { token: b.token });
  assert.ok(await Saved.exists({ user: b.id, listing: l._id }));
  assert.equal((await call('POST', `/api/me/saved/not-an-id/registered`, { token: a.token })).status, 404);
});

// =====================================================================================================================
test('plan split: hosting hackathon rooms and smart matching are Pro; connecting, DMs and joining by invitation stay free', async () => {
  const free = await mkUser('Fred Free'); const host = await mkUser('Hope Host', { pro: true });
  // Pro-only: recommendations
  for (const p of ['/api/network/recommendations/teammates', '/api/network/recommendations/teams']) { const r = await call('GET', p, { token: free.token }); assert.equal(r.status, 402, p); assert.equal(r.body.code, 'PRO_REQUIRED'); }
  // Pro-only: hosting (teams, team rooms, private rooms, invites, tracker share)
  const l = await mkListing('Gate Hack');
  await Saved.create({ user: free.id, listing: l._id, status: 'saved' });
  for (const [m, p, body] of [['POST', '/api/teams', { name: 'Free team' }], ['POST', '/api/chat/rooms', { name: 'Free room' }], ['POST', '/api/teams/share', { listingId: String(l._id), email: host.email }]]) {
    const r = await call(m, p, { token: free.token, body }); assert.equal(r.status, 402, `${m} ${p}`); assert.equal(r.body.code, 'PRO_REQUIRED');
  }
  assert.equal(await Team.countDocuments({ owner: free.id }), 0, 'nothing was created');
  assert.equal((await call('GET', '/api/network/people?q=zz', { token: free.token })).body.smart, false, 'free search is name-only');

  // Free: connect, DM, and join a Pro host's team by invitation (then chat in its room)
  await befriend(free, host);
  const dm = (await call('POST', '/api/chat/rooms/dm', { token: free.token, body: { userId: host.id } })).body.roomId;
  assert.equal((await call('POST', `/api/chat/rooms/${dm}/messages`, { token: free.token, body: { text: 'hi from a free account' } })).status, 201, 'DMs are free');
  const team = (await call('POST', '/api/teams', { token: host.token, body: { name: 'Hosted by Pro', listingId: String(l._id) } })).body.team;
  assert.equal((await call('POST', `/api/teams/${team.id}/invite`, { token: host.token, body: { userId: free.id } })).status, 200);
  const inv = (await call('GET', '/api/network/overview', { token: free.token })).body.invites.incoming[0];
  assert.equal((await call('POST', `/api/network/invites/${inv.id}/accept`, { token: free.token })).status, 200, 'a free user can accept an invitation');
  assert.equal((await call('POST', `/api/chat/rooms/${team.room}/messages`, { token: free.token, body: { text: 'free member in a Pro team room' } })).status, 201, 'and chat in the team room');
  assert.equal((await call('GET', `/api/teams/${team.id}`, { token: free.token })).status, 200);
  // ...but not the Pro extras inside it, and not hosting
  assert.equal((await call('GET', `/api/teams/${team.id}/ideas`, { token: free.token })).status, 402);
  assert.equal((await call('POST', `/api/teams/${team.id}/request`, { token: free.token, body: {} })).status, 402);
  const mine = await call('GET', '/api/chat/rooms', { token: free.token }); assert.equal(mine.status, 200);
  assert.ok(mine.body.rooms.length >= 2, 'the free user sees the DM and the team room');
  assert.equal((await call('PUT', `/api/teams/${team.id}`, { token: free.token, body: { name: 'x' } })).status, 403, 'members cannot manage the team');
});

// A free user who already owns a team (created before this rule) keeps it, but cannot expand it
test('grandfathering: an existing free owner keeps their team and room but cannot invite more people', async () => {
  const old = await mkUser('Old Olly'); const pal = await mkUser('Pal Pia');
  await User.updateOne({ _id: old.id }, { $set: { 'plan.tier': 'pro' } });
  const team = (await call('POST', '/api/teams', { token: old.token, body: { name: 'Legacy team' } })).body.team;
  await User.updateOne({ _id: old.id }, { $set: { 'plan.tier': 'free' } }); // later downgraded
  assert.equal((await call('GET', `/api/teams/${team.id}`, { token: old.token })).status, 200, 'still sees the team');
  assert.equal((await call('POST', `/api/chat/rooms/${team.room}/messages`, { token: old.token, body: { text: 'still works' } })).status, 201, 'still chats in the room');
  const r = await call('POST', `/api/teams/${team.id}/invite`, { token: old.token, body: { email: pal.email } });
  assert.equal(r.status, 402); assert.equal(r.body.code, 'PRO_REQUIRED');
});

test('Pro recommendations: only discoverable people, shared-tracking signal, complementary skills, blocked excluded, no private data', async () => {
  const me = await mkUser('Pro Pat', { pro: true, discoverable: true, skills: ['react', 'node'] });
  const hack = await mkUser('Hack Hana', { discoverable: true, skills: ['figma', 'ui design', 'react'] });
  const clone = await mkUser('Clone Cal', { discoverable: true, skills: ['react', 'node'] });
  const hidden = await mkUser('Hidden Hal', { discoverable: false, skills: ['rust', 'go', 'k8s'] });
  const blocked = await mkUser('Blocked Bea', { discoverable: true, skills: ['rust', 'go', 'k8s', 'ml'] });
  const l = await mkListing('Shared Interest Hack');
  for (const u of [me, hack]) await Saved.create({ user: u.id, listing: l._id, status: 'saved' });
  await User.updateOne({ _id: hack.id }, { $set: { 'social.lookingForTeam': true, githubUrl: 'https://github.com/hana' } });
  await call('POST', '/api/network/block', { token: me.token, body: { userId: blocked.id } });

  const r = await call('GET', '/api/network/recommendations/teammates', { token: me.token });
  assert.equal(r.status, 200); assert.equal(r.body.discoverable, true);
  const names = r.body.teammates.map((t) => t.name);
  assert.deepEqual(names.slice(0, 1), ['Hack Hana'], 'complementary skills + shared tracked hackathon + looking for a team rank first');
  assert.ok(names.includes('Clone Cal')); assert.ok(!names.includes('Hidden Hal'), 'non-discoverable users are never recommended'); assert.ok(!names.includes('Blocked Bea'), 'blocked users are excluded');
  assert.ok(!names.includes('Pro Pat'), 'never recommends yourself');
  const top = r.body.teammates[0];
  assert.ok(top.matchReasons.some((x) => /Also tracking Shared Interest Hack/.test(x)));
  assert.ok(top.matchReasons.some((x) => /figma/i.test(x)));
  assert.ok(top.matchScore > r.body.teammates.find((t) => t.name === 'Clone Cal').matchScore, 'complementary beats a clone');
  assert.ok(!/@example\.com|email/i.test(r.text), 'no email addresses or private fields in recommendations');
  assert.ok(top.matchScore >= 0 && top.matchScore <= 100);

  // smart people search (Pro): plain English
  const s = await call('GET', `/api/network/people?q=${encodeURIComponent('figma designer looking for a team')}`, { token: me.token });
  assert.equal(s.body.smart, true); assert.equal(s.body.people[0].name, 'Hack Hana');
});

test('Pro teams: public team + recommendations + join request approval; idea board voting rules', async () => {
  const owner = await mkUser('Own Olive', { pro: true, discoverable: true, skills: ['python'] });
  const seeker = await mkUser('Seek Sam', { pro: true, discoverable: true, skills: ['react', 'figma'] });
  const l = await mkListing('Open Team Hack');
  await Saved.create({ user: seeker.id, listing: l._id, status: 'saved' });
  const team = (await call('POST', '/api/teams', { token: owner.token, body: { name: 'Open Squad', listingId: String(l._id), visibility: 'public', maxMembers: 3, lookingFor: ['React', 'Figma'], description: 'Need frontend' } })).body.team;
  assert.equal(team.visibility, 'public');

  const recs = await call('GET', '/api/network/recommendations/teams', { token: seeker.token });
  const rec = recs.body.teams.find((t) => t.id === team.id);
  assert.ok(rec, 'public team with open slots is recommended'); assert.ok(rec.matchReasons.some((r) => /tracking Open Team Hack/.test(r)) && rec.matchReasons.some((r) => /react/i.test(r)));
  assert.ok(!(await call('GET', '/api/network/recommendations/teams', { token: owner.token })).body.teams.some((t) => t.id === team.id), 'never recommends your own team');

  assert.equal((await call('POST', `/api/teams/${team.id}/request`, { token: seeker.token, body: { message: 'I do frontend' } })).status, 200);
  const req = (await call('GET', '/api/network/overview', { token: owner.token })).body.invites.incoming.find((i) => i.kind === 'team_request');
  assert.ok(req && req.from.name === 'Seek Sam');
  assert.equal((await call('POST', `/api/network/invites/${req.id}/accept`, { token: seeker.token })).status, 404, 'only the owner approves');
  assert.equal((await call('POST', `/api/network/invites/${req.id}/accept`, { token: owner.token })).status, 200);
  assert.equal((await call('GET', `/api/teams/${team.id}`, { token: seeker.token })).body.team.members.length, 2);
  assert.ok(await Saved.exists({ user: seeker.id, listing: l._id }));

  // ideas
  const mk = (tok, title) => call('POST', `/api/teams/${team.id}/ideas`, { token: tok, body: { title } });
  const i1 = (await mk(owner.token, 'AI study buddy')).body.idea; const i2 = (await mk(seeker.token, 'Campus carpool')).body.idea;
  assert.equal((await mk(owner.token, 'x')).status, 400, 'title too short');
  assert.equal((await call('POST', `/api/teams/${team.id}/ideas/${i1.id}/vote`, { token: owner.token, body: { rank: 1 } })).status, 400, 'no voting for your own idea');
  assert.equal((await call('POST', `/api/teams/${team.id}/ideas/${i1.id}/vote`, { token: seeker.token, body: { rank: 3 } })).status, 400);
  let v = await call('POST', `/api/teams/${team.id}/ideas/${i1.id}/vote`, { token: seeker.token, body: { rank: 1 } });
  assert.equal(v.body.ideas.find((i) => i.id === i1.id).score, 10);
  v = await call('POST', `/api/teams/${team.id}/ideas/${i2.id}/vote`, { token: owner.token, body: { rank: 2 } });
  assert.equal(v.body.ideas.find((i) => i.id === i2.id).score, 5);
  const stranger = await mkUser('Out Otto', { pro: true });
  assert.equal((await call('GET', `/api/teams/${team.id}/ideas`, { token: stranger.token })).status, 404, 'non-members cannot see the idea board');
  assert.equal((await call('DELETE', `/api/teams/${team.id}/ideas/${i1.id}`, { token: seeker.token })).status, 403);
  assert.equal((await call('DELETE', `/api/teams/${team.id}/ideas/${i1.id}`, { token: owner.token })).status, 200);
});

// =====================================================================================================================
test('email reminders: opt-in, verified only, on schedule, never twice, never stale, never after the deadline', async () => {
  const mk = (name, over) => mkUser(name, over);
  const on = await mk('Remy On'); const off = await mk('Rita Off'); const unverified = await mk('Ulf Unverified', { verified: false });
  for (const u of [on, unverified]) await User.updateOne({ _id: u.id }, { $set: { 'notify.emailReminders': true } });
  const soon = await mkListing('Closes Tomorrow', { deadline: new Date(Date.now() + 23 * 3600000) }); // the 1-day reminder was due an hour ago
  const far = await mkListing('Closes Next Week', { deadline: new Date(Date.now() + 5 * DAY) }); // 1-day mark not reached yet
  const past = await mkListing('Already Closed', { deadline: new Date(Date.now() - 3600000) });
  for (const u of [on, off, unverified]) for (const l of [soon, far, past]) await Saved.create({ user: u.id, listing: l._id, status: 'applied' });

  outbox.length = 0;
  const r1 = await runReminders();
  const to = (u) => outbox.filter((m) => m.to === u.email);
  assert.equal(to(on).length, 1, 'exactly one reminder for the event inside its window'); assert.match(to(on)[0].subject, /Closes in 1 day: Closes Tomorrow/);
  assert.match(to(on)[0].text, /marked as applied/); assert.match(to(on)[0].text, /https:\/\/x\.example\/ClosesTomorrow/);
  assert.equal(to(off).length, 0, 'not opted in'); assert.equal(to(unverified).length, 0, 'unverified address');
  assert.ok(r1.sent >= 1);

  outbox.length = 0; await runReminders();
  assert.equal(to(on).length, 0, 'idempotent: a second run sends nothing');

  // custom lead times: 3 days is in the past for the 5-day event => stale reminders are skipped, but the 1-week... not due either
  await User.updateOne({ _id: on.id }, { $set: { 'calendar.reminders': [4320, 60] } });
  outbox.length = 0;
  await runReminders({ now: new Date(Date.now() + 4 * DAY + 3600000) }); // 'far' now closes in ~1 day: the 3-day mark passed 3 days ago (stale)
  assert.equal(outbox.filter((m) => m.to === on.email && /Closes Next Week/.test(m.subject)).length, 0, 'a lead time that passed long ago is not sent late');
  outbox.length = 0;
  await runReminders({ now: new Date(far.deadline.getTime() - 4320 * 60000 + 600000) }); // 10 minutes after the 3-day mark
  assert.equal(outbox.filter((m) => m.to === on.email && /Closes in 3 days: Closes Next Week/.test(m.subject)).length, 1, 'sent right after its moment');
  outbox.length = 0;
  await runReminders({ now: new Date(past.deadline.getTime() + 60000) });
  assert.equal(outbox.filter((m) => /Already Closed/.test(m.subject)).length, 0, 'never after the deadline');

  const set = await call('PUT', '/api/me/profile', { token: off.token, body: { notify: { emailReminders: true } } });
  assert.equal(set.body.user.notify.emailReminders, true, 'the setting is saved through the profile API');
});

// =====================================================================================================================
test('account deletion erases the social footprint and hands shared teams over', async () => {
  const [a, b] = [await mkUser('Del Dee', { pro: true }), await mkUser('Keep Kim')];
  await befriend(a, b);
  const dm = (await call('POST', '/api/chat/rooms/dm', { token: a.token, body: { userId: b.id } })).body.roomId;
  await call('POST', `/api/chat/rooms/${dm}/messages`, { token: a.token, body: { text: 'bye soon' } });
  const t = (await call('POST', '/api/teams', { token: a.token, body: { name: 'Handover' } })).body.team;
  await call('POST', `/api/teams/${t.id}/invite`, { token: a.token, body: { userId: b.id } });
  await call('POST', `/api/network/invites/${(await call('GET', '/api/network/overview', { token: b.token })).body.invites.incoming[0].id}/accept`, { token: b.token });
  await call('POST', `/api/chat/rooms/${t.room}/messages`, { token: a.token, body: { text: 'team msg by a' } });
  await call('POST', `/api/chat/rooms/${t.room}/messages`, { token: b.token, body: { text: 'team msg by b' } });

  assert.equal((await call('DELETE', '/api/auth/me', { token: a.token, body: { password: PW } })).status, 200);
  assert.equal(await Connection.countDocuments({ $or: [{ requester: a.id }, { recipient: a.id }] }), 0);
  assert.equal(await Room.countDocuments({ _id: dm }), 0, 'DMs are deleted');
  assert.equal(await Message.countDocuments({ sender: a.id }), 0, 'their messages are erased from shared rooms');
  const team = await Team.findById(t.id);
  assert.equal(String(team.owner), b.id, 'ownership handed to the remaining member'); assert.equal(team.members.length, 1);
  assert.equal((await call('GET', `/api/chat/rooms/${t.room}/messages`, { token: b.token })).body.messages.map((m) => m.text).join(), 'team msg by b');
  assert.equal((await call('GET', '/api/network/overview', { token: b.token })).body.connections.length, 0);
});

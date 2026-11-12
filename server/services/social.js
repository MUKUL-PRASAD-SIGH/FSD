// Connections between users: requests, accept/decline, removal and blocking. Used by chat, teams and the network routes.
const mongoose = require('mongoose');
const Connection = require('../models/Connection');
const User = require('../models/User');
const { notify } = require('./notify');

const fail = (status, message) => Object.assign(new Error(message), { status });
// Hosting hackathon rooms is a Pro feature. Joining one by invitation is free.
const proOnly = (user, what) => {
  if (!user?.isPro?.()) throw Object.assign(fail(402, `${what} is a Pro feature. Activate Pro on the Plan page.`), { code: 'PRO_REQUIRED' });
};
const oid = (v) => (mongoose.isValidObjectId(v) ? String(v) : null);
const DAILY_REQUEST_CAP = 50;

// What a person may see of another person: never email, never anything private.
const card = (u, extra = {}) => ({ id: String(u._id), name: u.name, headline: u.social?.headline || '', avatar: u.avatar || '', ...extra });

async function relation(a, b) {
  const c = await Connection.findOne({ pair: Connection.pairKey(a, b) }).lean();
  if (!c) return { status: 'none', conn: null };
  if (c.status === 'blocked') return { status: 'blocked', conn: c, blockedByMe: String(c.blockedBy) === String(a) };
  if (c.status === 'pending') return { status: String(c.requester) === String(a) ? 'outgoing' : 'incoming', conn: c };
  return { status: c.status, conn: c }; // accepted | declined
}
const isBlocked = async (a, b) => (await relation(a, b)).status === 'blocked';
const areConnected = async (a, b) => (await relation(a, b)).status === 'accepted';

async function request(from, to, { message } = {}) {
  if (String(from._id) === String(to._id)) throw fail(400, 'You cannot connect with yourself');
  const since = new Date(Date.now() - 86400000);
  if ((await Connection.countDocuments({ requester: from._id, createdAt: { $gte: since } })) >= DAILY_REQUEST_CAP) throw fail(429, 'Daily connection request limit reached. Try again tomorrow.');
  const pair = Connection.pairKey(from._id, to._id);
  const existing = await Connection.findOne({ pair });
  if (existing) {
    if (existing.status === 'blocked') throw fail(403, 'You cannot connect with this person');
    if (existing.status === 'accepted') return { status: 'accepted', already: true };
    if (existing.status === 'pending') {
      if (String(existing.requester) === String(to._id)) return { status: 'accepted', conn: await accept(existing._id, from) }; // they already asked us: connect
      return { status: 'pending', already: true };
    }
    // previously declined: allow asking again
    existing.status = 'pending'; existing.requester = from._id; existing.recipient = to._id; existing.respondedAt = undefined;
    await existing.save();
  } else {
    await Connection.create({ pair, requester: from._id, recipient: to._id });
  }
  await notify(to._id, { type: 'connection_request', title: `${from.name} wants to connect`, body: message ? String(message).slice(0, 200) : 'Accept to start chatting and team up.', link: '/network' });
  return { status: 'pending' };
}

async function accept(connId, user) {
  const c = await Connection.findById(oid(connId));
  if (!c || c.status !== 'pending' || String(c.recipient) !== String(user._id)) throw fail(404, 'Request not found');
  c.status = 'accepted'; c.respondedAt = new Date();
  await c.save();
  await notify(c.requester, { type: 'connection_accepted', title: `${user.name} accepted your request`, body: 'You can now message each other and invite one another to teams.', link: '/chat' });
  return c;
}

async function decline(connId, user) {
  const c = await Connection.findById(oid(connId));
  if (!c || c.status !== 'pending' || String(c.recipient) !== String(user._id)) throw fail(404, 'Request not found');
  c.status = 'declined'; c.respondedAt = new Date();
  await c.save();
}

async function cancel(connId, user) {
  const r = await Connection.deleteOne({ _id: oid(connId) || undefined, status: 'pending', requester: user._id });
  if (!r.deletedCount) throw fail(404, 'Request not found');
}

async function remove(user, otherId) {
  await Connection.deleteOne({ pair: Connection.pairKey(user._id, otherId), status: 'accepted' });
}

async function block(user, otherId) {
  if (String(user._id) === String(otherId)) throw fail(400, 'You cannot block yourself');
  if (!(await User.exists({ _id: otherId }))) throw fail(404, 'Person not found');
  const pair = Connection.pairKey(user._id, otherId);
  await Connection.findOneAndUpdate({ pair }, { $set: { status: 'blocked', blockedBy: user._id, respondedAt: new Date() }, $setOnInsert: { pair, requester: user._id, recipient: otherId } }, { upsert: true });
}

async function unblock(user, otherId) {
  await Connection.deleteOne({ pair: Connection.pairKey(user._id, otherId), status: 'blocked', blockedBy: user._id });
}

// Everything for the Network page
async function overview(user) {
  const rows = await Connection.find({ $or: [{ requester: user._id }, { recipient: user._id }], status: { $in: ['pending', 'accepted'] } }).sort({ updatedAt: -1 }).lean();
  const ids = [...new Set(rows.flatMap((r) => [String(r.requester), String(r.recipient)]).filter((x) => x !== String(user._id)))];
  const users = await User.find({ _id: { $in: ids }, status: 'active' }).select('name avatar social.headline').lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  const other = (r) => byId.get(String(r.requester) === String(user._id) ? String(r.recipient) : String(r.requester));
  const out = { connections: [], incoming: [], outgoing: [] };
  for (const r of rows) {
    const u = other(r); if (!u) continue;
    if (r.status === 'accepted') out.connections.push(card(u, { since: r.respondedAt || r.updatedAt }));
    else if (String(r.recipient) === String(user._id)) out.incoming.push(card(u, { requestId: String(r._id), at: r.createdAt }));
    else out.outgoing.push(card(u, { requestId: String(r._id), at: r.createdAt }));
  }
  return out;
}

const blockedList = async (user) => {
  const rows = await Connection.find({ status: 'blocked', blockedBy: user._id }).lean();
  const users = await User.find({ _id: { $in: rows.map((r) => (String(r.requester) === String(user._id) ? r.recipient : r.requester)) } }).select('name avatar social.headline').lean();
  return users.map((u) => card(u));
};

// A registered, active user by id or exact email; null when none. Callers must NOT reveal which it was (account enumeration).
async function findTarget({ userId, email }) {
  if (userId && oid(userId)) return User.findOne({ _id: userId, status: 'active' });
  const e = String(email || '').trim().toLowerCase();
  if (e && e.length <= 254 && /^\S+@\S+\.\S+$/.test(e)) return User.findOne({ email: e, status: 'active' });
  return null;
}

module.exports = { fail, proOnly, oid, card, relation, isBlocked, areConnected, request, accept, decline, cancel, remove, block, unblock, overview, blockedList, findTarget };

// Rooms and messages. Access rule everywhere: you must be listed in room.members. DMs additionally require an accepted
// connection (and no block); the rest of the rules (team membership, invites) are enforced by the callers that add members.
const Room = require('../models/Room');
const Message = require('../models/Message');
const User = require('../models/User');
const realtime = require('./realtime');
const social = require('./social');

const { fail, oid } = social;
const MAX_TEXT = 2000;

const serializeMessage = (m, sender) => ({
  id: String(m._id), roomId: String(m.room), senderId: String(m.sender), senderName: sender?.name || undefined, text: m.text, createdAt: m.createdAt,
});

async function loadRoomFor(roomId, userId) {
  const id = oid(roomId);
  if (!id) throw fail(404, 'Conversation not found');
  const room = await Room.findOne({ _id: id, 'members.user': userId });
  if (!room) throw fail(404, 'Conversation not found'); // same answer for "does not exist" and "not yours"
  return room;
}

async function sendMessage({ roomId, userId, text }) {
  const clean = String(text ?? '').replace(/\u0000/g, '').trim();
  if (!clean) throw fail(400, 'Write something first');
  if (clean.length > MAX_TEXT) throw fail(400, `Messages can be at most ${MAX_TEXT} characters`);
  const room = await loadRoomFor(roomId, userId);
  if (room.kind === 'dm') {
    const other = room.members.find((m) => String(m.user) !== String(userId));
    if (!other || !(await social.areConnected(userId, other.user))) throw fail(403, 'You can only message people you are connected with');
  }
  const m = await Message.create({ room: room._id, sender: userId, text: clean });
  const now = m.createdAt;
  await Room.updateOne(
    { _id: room._id, 'members.user': userId },
    { $set: { lastMessageAt: now, lastMessageText: clean.slice(0, 140), lastMessageSender: userId, 'members.$.lastReadAt': now } }
  );
  const sender = await User.findById(userId).select('name').lean();
  const out = serializeMessage(m, sender);
  realtime.emitToRoom(String(room._id), 'message:new', out);
  return out;
}

async function history(roomId, userId, { before, limit = 40 } = {}) {
  const room = await loadRoomFor(roomId, userId);
  const q = { room: room._id };
  if (before) { const d = new Date(before); if (!isNaN(d)) q.createdAt = { $lt: d }; }
  const rows = await Message.find(q).sort({ createdAt: -1 }).limit(Math.min(100, Math.max(1, Number(limit) || 40))).lean();
  const senders = await User.find({ _id: { $in: [...new Set(rows.map((r) => String(r.sender)))] } }).select('name').lean();
  const names = new Map(senders.map((s) => [String(s._id), s]));
  return rows.reverse().map((m) => serializeMessage(m, names.get(String(m.sender))));
}

async function markRead(roomId, userId) {
  const room = await loadRoomFor(roomId, userId);
  await Room.updateOne({ _id: room._id, 'members.user': userId }, { $set: { 'members.$.lastReadAt': new Date() } });
}

async function unreadCount(room, userId) {
  const me = room.members.find((m) => String(m.user) === String(userId));
  return Message.countDocuments({ room: room._id, sender: { $ne: userId }, createdAt: { $gt: me?.lastReadAt || new Date(0) } });
}

// The chat sidebar: every room I am in, newest activity first, with a name and unread count that make sense to ME
async function listRooms(userId) {
  const rooms = await Room.find({ 'members.user': userId }).sort({ lastMessageAt: -1 }).limit(100).lean();
  const otherIds = rooms.filter((r) => r.kind === 'dm').map((r) => String(r.members.find((m) => String(m.user) !== String(userId))?.user));
  const people = await User.find({ _id: { $in: otherIds } }).select('name avatar social.headline').lean();
  const byId = new Map(people.map((p) => [String(p._id), p]));
  const out = [];
  for (const r of rooms) {
    const other = r.kind === 'dm' ? byId.get(String(r.members.find((m) => String(m.user) !== String(userId))?.user)) : null;
    out.push({
      id: String(r._id), kind: r.kind, name: r.kind === 'dm' ? (other?.name || 'Former member') : r.name, team: r.team ? String(r.team) : null,
      memberCount: r.members.length, lastMessageAt: r.lastMessageAt, lastMessageText: r.lastMessageText,
      lastMessageMine: r.lastMessageSender ? String(r.lastMessageSender) === String(userId) : false,
      unread: await unreadCount(r, userId), peer: other ? social.card(other) : null,
      owner: String(r.members.find((m) => m.role === 'owner')?.user || ''),
    });
  }
  return out;
}

async function ensureDm(userId, otherId) {
  if (String(userId) === String(otherId)) throw fail(400, 'You cannot message yourself');
  if (!(await social.areConnected(userId, otherId))) throw fail(403, 'Connect with this person first');
  const dmKey = [String(userId), String(otherId)].sort().join('_');
  let room = await Room.findOne({ dmKey });
  if (!room) {
    try { room = await Room.create({ kind: 'dm', dmKey, createdBy: userId, members: [{ user: userId }, { user: otherId }] }); }
    catch (e) { if (e.code === 11000) room = await Room.findOne({ dmKey }); else throw e; } // two people opened it at once
    realtime.joinRoom(userId, room._id); realtime.joinRoom(otherId, room._id);
  }
  return room;
}

async function createGroup(owner, name) {
  const room = await Room.create({ kind: 'group', name, createdBy: owner._id, members: [{ user: owner._id, role: 'owner' }] });
  realtime.joinRoom(owner._id, room._id);
  return room;
}

async function addMember(roomId, userId) {
  const r = await Room.updateOne({ _id: roomId, 'members.user': { $ne: userId } }, { $push: { members: { user: userId, role: 'member', joinedAt: new Date(), lastReadAt: new Date() } } });
  realtime.joinRoom(userId, roomId);
  realtime.emitToUser(userId, 'room:added', { roomId: String(roomId) });
  return r.modifiedCount > 0;
}

async function removeMember(roomId, userId) {
  await Room.updateOne({ _id: roomId }, { $pull: { members: { user: userId } } });
  realtime.leaveRoom(userId, roomId);
  realtime.emitToUser(userId, 'room:removed', { roomId: String(roomId) });
}

async function deleteRoom(roomId) {
  realtime.emitToRoom(String(roomId), 'room:removed', { roomId: String(roomId) });
  realtime.dropRoom(String(roomId));
  await Message.deleteMany({ room: roomId });
  await Room.deleteOne({ _id: roomId });
}

async function roomDetail(roomId, userId) {
  const room = await loadRoomFor(roomId, userId);
  const users = await User.find({ _id: { $in: room.members.map((m) => m.user) } }).select('name avatar social.headline').lean();
  const by = new Map(users.map((u) => [String(u._id), u]));
  return {
    id: String(room._id), kind: room.kind, name: room.name, team: room.team ? String(room.team) : null,
    members: room.members.map((m) => ({ ...social.card(by.get(String(m.user)) || { _id: m.user, name: 'Former member' }), role: m.role })),
  };
}

module.exports = { sendMessage, history, markRead, listRooms, ensureDm, createGroup, addMember, removeMember, deleteRoom, roomDetail, loadRoomFor, unreadCount, MAX_TEXT };

// Removes a user's social footprint when they delete their account: connections, invites, direct messages, their messages in
// shared rooms, idea votes, and their place in teams/rooms. Teams and rooms that others still use are handed over, not destroyed.
const Connection = require('../models/Connection');
const Invite = require('../models/Invite');
const Team = require('../models/Team');
const Room = require('../models/Room');
const Message = require('../models/Message');
const Idea = require('../models/Idea');
const chat = require('./chat');
const teams = require('./teams');

async function eraseUser(userId) {
  await Promise.all([
    Connection.deleteMany({ $or: [{ requester: userId }, { recipient: userId }] }),
    Invite.deleteMany({ $or: [{ from: userId }, { to: userId }] }),
  ]);

  // Teams: sole member -> disband; owner with others -> hand over to the longest-standing member; otherwise just leave
  for (const t of await Team.find({ 'members.user': userId })) {
    const others = t.members.filter((m) => String(m.user) !== String(userId));
    if (!others.length) { await teams.disband(t); continue; }
    if (String(t.owner) === String(userId)) {
      const next = others.slice().sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt))[0].user;
      await Team.updateOne({ _id: t._id }, { $set: { owner: next, 'members.$[n].role': 'owner' } }, { arrayFilters: [{ 'n.user': next }] });
      await Room.updateOne({ _id: t.room }, { $set: { 'members.$[n].role': 'owner' } }, { arrayFilters: [{ 'n.user': next }] });
    }
    await Team.updateOne({ _id: t._id }, { $pull: { members: { user: userId } } });
    if (t.room) await Room.updateOne({ _id: t.room }, { $pull: { members: { user: userId } } });
  }

  for (const r of await Room.find({ 'members.user': userId, kind: { $in: ['dm', 'group'] } })) {
    const others = r.members.filter((m) => String(m.user) !== String(userId));
    if (r.kind === 'dm' || !others.length) { await chat.deleteRoom(r._id); continue; }
    if (r.members.find((m) => String(m.user) === String(userId))?.role === 'owner') {
      await Room.updateOne({ _id: r._id }, { $set: { 'members.$[n].role': 'owner' } }, { arrayFilters: [{ 'n.user': others[0].user }] });
    }
    await Room.updateOne({ _id: r._id }, { $pull: { members: { user: userId } } });
  }

  await Promise.all([
    Message.deleteMany({ sender: userId }),
    Idea.deleteMany({ author: userId }),
    Idea.updateMany({ 'votes.user': userId }, { $pull: { votes: { user: userId } } }),
  ]);
}

module.exports = { eraseUser };

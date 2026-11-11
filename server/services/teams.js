// Teams, invites and the "share this hackathon with a teammate" flow.
//
// Invite pipeline (one Invite model): create -> notify (in-app live, email if allowed) -> accept | decline | cancel | expire.
// Accepting a team invite: joins the team AND its private room AND saves the hackathon into the invitee's tracker.
// Inviting by email never reveals whether the address belongs to an account: the response is identical either way.
const Team = require('../models/Team');
const Room = require('../models/Room');
const Invite = require('../models/Invite');
const Idea = require('../models/Idea');
const Listing = require('../models/Listing');
const Saved = require('../models/Saved');
const User = require('../models/User');
const chat = require('./chat');
const social = require('./social');
const { notify } = require('./notify');

const { fail, oid } = social;
const PENDING_DAYS = 14;
const RESOLVED_DAYS = 30;
const DAILY_INVITE_CAP = 50;
const days = (n) => new Date(Date.now() + n * 86400000);
const uniqSkills = (a) => [...new Set((Array.isArray(a) ? a : []).map((s) => String(s).trim().slice(0, 40)).filter(Boolean))].slice(0, 12);

const isMember = (team, userId) => team.members.some((m) => String(m.user) === String(userId));
const isOwner = (team, userId) => String(team.owner) === String(userId);

async function loadTeam(id, user, { owner = false } = {}) {
  const tid = oid(id);
  const team = tid ? await Team.findById(tid) : null;
  if (!team || !isMember(team, user._id)) throw fail(404, 'Team not found'); // same answer for missing and not-yours
  if (owner && !isOwner(team, user._id)) throw fail(403, 'Only the team owner can do that');
  return team;
}

async function track(userId, listingId, status = 'saved') {
  if (!listingId) return;
  await Saved.updateOne({ user: userId, listing: listingId }, { $setOnInsert: { user: userId, listing: listingId, status } }, { upsert: true });
}

async function createTeam(user, b = {}) {
  const name = String(b.name || '').trim();
  if (name.length < 2 || name.length > 80) throw fail(400, 'Give the team a name (2 to 80 characters)');
  const visibility = b.visibility === 'public' ? 'public' : 'private';
  if (visibility === 'public' && !user.isPro()) throw Object.assign(fail(402, 'Public teams that others can request to join are a Pro feature.'), { code: 'PRO_REQUIRED' });
  let listing = null;
  if (b.listingId) {
    listing = oid(b.listingId) ? await Listing.findOne({ _id: b.listingId, status: 'published' }).select('title').lean() : null;
    if (!listing) throw fail(404, 'That hackathon was not found');
  }
  const maxMembers = b.maxMembers === undefined ? 4 : Number(b.maxMembers);
  if (!Number.isInteger(maxMembers) || maxMembers < 2 || maxMembers > 10) throw fail(400, 'Team size must be between 2 and 10');
  const team = await Team.create({
    name, owner: user._id, listing: listing?._id, maxMembers, visibility, lookingFor: uniqSkills(b.lookingFor),
    description: String(b.description || '').slice(0, 300), members: [{ user: user._id, role: 'owner' }],
  });
  const room = await Room.create({ kind: 'team', name, team: team._id, createdBy: user._id, members: [{ user: user._id, role: 'owner' }] });
  team.room = room._id; await team.save();
  require('./realtime').joinRoom(user._id, room._id);
  await track(user._id, listing?._id);
  return team;
}

async function view(team, viewer) {
  const ids = team.members.map((m) => m.user);
  const [users, listing] = await Promise.all([
    User.find({ _id: { $in: ids } }).select('name avatar social.headline skills').lean(),
    team.listing ? Listing.findById(team.listing).select('title url deadline platform status').lean() : null,
  ]);
  const by = new Map(users.map((u) => [String(u._id), u]));
  const mine = isOwner(team, viewer._id);
  const pending = mine ? await Invite.find({ team: team._id, status: 'pending' }).populate('to', 'name').lean() : [];
  return {
    id: String(team._id), name: team.name, description: team.description, visibility: team.visibility, maxMembers: team.maxMembers, lookingFor: team.lookingFor,
    owner: String(team.owner), isOwner: mine, room: team.room ? String(team.room) : null,
    listing: listing ? { id: String(listing._id), title: listing.title, url: listing.url, deadline: listing.deadline, platform: listing.platform } : null,
    members: team.members.map((m) => ({ ...social.card(by.get(String(m.user)) || { _id: m.user, name: 'Former member' }), role: m.role, skills: (by.get(String(m.user))?.skills || []).slice(0, 8), joinedAt: m.joinedAt })),
    openSlots: Math.max(0, team.maxMembers - team.members.length),
    pendingInvites: pending.map((i) => ({ id: String(i._id), kind: i.kind, to: i.to ? { id: String(i.to._id), name: i.to.name } : null, at: i.createdAt })),
  };
}

async function listMine(user) {
  const teams = await Team.find({ 'members.user': user._id }).sort({ updatedAt: -1 }).limit(50);
  return Promise.all(teams.map((t) => view(t, user)));
}

// ---- invites
async function createInvite({ kind, from, to, team, room, message }) {
  const since = new Date(Date.now() - 86400000);
  if ((await Invite.countDocuments({ from: from._id, createdAt: { $gte: since } })) >= DAILY_INVITE_CAP) throw fail(429, 'Daily invite limit reached. Try again tomorrow.');
  const target = String((team || room)._id);
  try {
    return await Invite.create({ kind, from: from._id, to: to._id, team: team?._id, room: room?._id, target, message: String(message || '').slice(0, 300), expiresAt: days(PENDING_DAYS) });
  } catch (e) { if (e.code === 11000) return null; throw e; } // already pending: idempotent
}

const GENERIC = { ok: true, message: 'If that person is on HackElite, they have been sent your invitation.' };

async function inviteToTeam(team, from, { userId, email, message }) {
  const target = await social.findTarget({ userId, email });
  if (!target || String(target._id) === String(from._id) || isMember(team, target._id) || (await social.isBlocked(from._id, target._id))) return GENERIC;
  if (team.members.length >= team.maxMembers) throw fail(409, 'This team is full');
  const inv = await createInvite({ kind: 'team_invite', from, to: target, team, message });
  if (inv) {
    const listing = team.listing ? await Listing.findById(team.listing).select('title').lean() : null;
    await notify(target._id, { type: 'team_invite', title: `${from.name} invited you to join “${team.name}”`, body: listing ? `For ${listing.title}. ${message ? '“' + String(message).slice(0, 160) + '”' : ''}`.trim() : (message ? String(message).slice(0, 200) : 'Open to accept or decline.'), link: '/network' });
  }
  return GENERIC;
}

async function requestToJoin(team, user, message) {
  if (!user.isPro()) throw Object.assign(fail(402, 'Requesting to join public teams is a Pro feature.'), { code: 'PRO_REQUIRED' });
  if (team.visibility !== 'public') throw fail(404, 'Team not found');
  if (isMember(team, user._id)) throw fail(409, 'You are already in this team');
  if (team.members.length >= team.maxMembers) throw fail(409, 'This team is full');
  if (await social.isBlocked(user._id, team.owner)) throw fail(404, 'Team not found');
  const owner = await User.findById(team.owner);
  const inv = await createInvite({ kind: 'team_request', from: user, to: owner, team, message });
  if (inv) await notify(owner._id, { type: 'team_request', title: `${user.name} wants to join “${team.name}”`, body: message ? String(message).slice(0, 200) : 'Open to approve or decline.', link: '/network' });
  return { ok: true };
}

async function inviteToRoom(room, from, userId) {
  if (room.kind !== 'group') throw fail(400, 'Only private group rooms use invitations');
  if (!room.members.some((m) => String(m.user) === String(from._id) && m.role === 'owner')) throw fail(403, 'Only the room owner can invite people');
  const target = userId && oid(userId) ? await User.findOne({ _id: userId, status: 'active' }) : null;
  if (!target || String(target._id) === String(from._id) || room.members.some((m) => String(m.user) === String(target._id))) return GENERIC;
  if (!(await social.areConnected(from._id, target._id))) throw fail(403, 'You can invite people you are connected with');
  const inv = await createInvite({ kind: 'room_invite', from, to: target, room });
  if (inv) await notify(target._id, { type: 'room_invite', title: `${from.name} invited you to the private room “${room.name}”`, body: 'Open to join the conversation.', link: '/network' });
  return GENERIC;
}

async function resolve(inv, status) {
  inv.status = status; inv.expiresAt = days(RESOLVED_DAYS);
  await inv.save();
}

async function respond(inviteId, user, accept) {
  const inv = await Invite.findById(oid(inviteId));
  // the recipient answers: the invitee for invites, the team owner for join requests
  const mine = inv && inv.status === 'pending' && String(inv.to) === String(user._id);
  if (!mine || inv.expiresAt < new Date()) throw fail(404, 'Invitation not found or expired');
  if (!accept) { await resolve(inv, 'declined'); return { status: 'declined' }; }

  if (inv.kind === 'room_invite') {
    const room = await Room.findById(inv.room);
    if (!room) { await resolve(inv, 'cancelled'); throw fail(404, 'That room no longer exists'); }
    await chat.addMember(room._id, user._id);
    await resolve(inv, 'accepted');
    await notify(inv.from, { type: 'team_joined', title: `${user.name} joined “${room.name}”`, link: '/chat', email: false });
    return { status: 'accepted', roomId: String(room._id) };
  }

  const team = await Team.findById(inv.team);
  if (!team) { await resolve(inv, 'cancelled'); throw fail(404, 'That team no longer exists'); }
  const joiner = inv.kind === 'team_invite' ? user : await User.findById(inv.from);
  if (!joiner || joiner.status !== 'active') { await resolve(inv, 'cancelled'); throw fail(404, 'That person is no longer available'); }
  if (isMember(team, joiner._id)) { await resolve(inv, 'accepted'); return { status: 'accepted', teamId: String(team._id) }; }
  // atomic capacity guard: the push only succeeds while there is still a free slot
  const joined = await Team.updateOne({ _id: team._id, 'members.user': { $ne: joiner._id }, $expr: { $lt: [{ $size: '$members' }, '$maxMembers'] } }, { $push: { members: { user: joiner._id, role: 'member', joinedAt: new Date() } } });
  if (!joined.modifiedCount) throw fail(409, 'This team is already full');
  await chat.addMember(team.room, joiner._id);
  await track(joiner._id, team.listing);
  await resolve(inv, 'accepted');
  await notify(inv.kind === 'team_invite' ? team.owner : joiner._id, { type: 'team_joined', title: inv.kind === 'team_invite' ? `${user.name} joined “${team.name}”` : `You are now in “${team.name}”`, body: 'Say hello in the team room.', link: `/teams/${team._id}`, email: inv.kind !== 'team_invite' });
  return { status: 'accepted', teamId: String(team._id) };
}

async function cancelInvite(inviteId, user) {
  const inv = await Invite.findOne({ _id: oid(inviteId), from: user._id, status: 'pending' });
  if (!inv) throw fail(404, 'Invitation not found');
  await resolve(inv, 'cancelled');
}

async function invitesFor(user) {
  const now = new Date();
  const [incoming, outgoing] = await Promise.all([
    Invite.find({ to: user._id, status: 'pending', expiresAt: { $gt: now } }).sort({ createdAt: -1 }).limit(50).populate('from', 'name social.headline').populate('team', 'name listing members maxMembers').populate('room', 'name').lean(),
    Invite.find({ from: user._id, status: 'pending', expiresAt: { $gt: now } }).sort({ createdAt: -1 }).limit(50).populate('to', 'name').populate('team', 'name').populate('room', 'name').lean(),
  ]);
  const shape = (i, who) => ({
    id: String(i._id), kind: i.kind, message: i.message, at: i.createdAt, expiresAt: i.expiresAt,
    [who]: i[who] ? { id: String(i[who]._id), name: i[who].name, headline: i[who].social?.headline || '' } : null,
    team: i.team ? { id: String(i.team._id), name: i.team.name } : null, room: i.room ? { id: String(i.room._id), name: i.room.name } : null,
  });
  return { incoming: incoming.map((i) => shape(i, 'from')), outgoing: outgoing.map((i) => shape(i, 'to')) };
}

// ---- team management
async function update(team, user, b) {
  if (typeof b.name === 'string') { const n = b.name.trim(); if (n.length < 2 || n.length > 80) throw fail(400, 'Give the team a name (2 to 80 characters)'); team.name = n; await Room.updateOne({ _id: team.room }, { $set: { name: n } }); }
  if (typeof b.description === 'string') team.description = b.description.slice(0, 300);
  if (b.lookingFor !== undefined) team.lookingFor = uniqSkills(b.lookingFor);
  if (b.maxMembers !== undefined) {
    const n = Number(b.maxMembers);
    if (!Number.isInteger(n) || n < 2 || n > 10) throw fail(400, 'Team size must be between 2 and 10');
    if (n < team.members.length) throw fail(400, 'The limit cannot be below the current number of members');
    team.maxMembers = n;
  }
  if (b.visibility !== undefined) {
    if (!['private', 'public'].includes(b.visibility)) throw fail(400, 'Invalid visibility');
    if (b.visibility === 'public' && !user.isPro()) throw Object.assign(fail(402, 'Public teams that others can request to join are a Pro feature.'), { code: 'PRO_REQUIRED' });
    team.visibility = b.visibility;
  }
  await team.save();
  return team;
}

async function removeMember(team, owner, userId) {
  if (!isMember(team, userId) || String(userId) === String(team.owner)) throw fail(400, 'That member cannot be removed');
  await Team.updateOne({ _id: team._id }, { $pull: { members: { user: userId } } });
  await chat.removeMember(team.room, userId);
  await Idea.updateMany({ team: team._id }, { $pull: { votes: { user: userId } } });
}

async function leave(team, user) {
  if (isOwner(team, user._id)) throw fail(400, 'Owners cannot leave. Transfer ownership or disband the team.');
  await removeMember(team, null, user._id);
}

async function transfer(team, owner, userId) {
  if (!isMember(team, userId) || String(userId) === String(owner._id)) throw fail(400, 'Choose another member');
  await Team.updateOne({ _id: team._id }, { $set: { owner: userId, 'members.$[o].role': 'member', 'members.$[n].role': 'owner' } }, { arrayFilters: [{ 'o.user': owner._id }, { 'n.user': userId }] });
  await Room.updateOne({ _id: team.room }, { $set: { 'members.$[o].role': 'member', 'members.$[n].role': 'owner' } }, { arrayFilters: [{ 'o.user': owner._id }, { 'n.user': userId }] });
}

async function disband(team) {
  await Invite.updateMany({ team: team._id, status: 'pending' }, { $set: { status: 'cancelled' } });
  await Idea.deleteMany({ team: team._id });
  if (team.room) await chat.deleteRoom(team.room);
  await Team.deleteOne({ _id: team._id });
}

// The tracker's "share with a teammate" button: find (or create) this user's team for the hackathon, then invite.
async function shareListing(user, { listingId, userId, email, teamId, message }) {
  const listing = oid(listingId) ? await Listing.findOne({ _id: listingId, status: 'published' }).select('title').lean() : null;
  if (!listing) throw fail(404, 'That hackathon was not found');
  if (!(await Saved.exists({ user: user._id, listing: listing._id }))) throw fail(400, 'Add this hackathon to your tracker first');
  let team;
  if (teamId) team = await loadTeam(teamId, user, { owner: true });
  else {
    team = await Team.findOne({ owner: user._id, listing: listing._id });
    if (!team) team = await createTeam(user, { name: `${listing.title}`.slice(0, 70) + ' team', listingId: listing._id });
  }
  const res = await inviteToTeam(team, user, { userId, email, message });
  return { ...res, teamId: String(team._id) };
}

module.exports = { loadTeam, createTeam, view, listMine, inviteToTeam, requestToJoin, inviteToRoom, respond, cancelInvite, invitesFor, update, removeMember, leave, transfer, disband, shareListing, isMember, isOwner, track, GENERIC };

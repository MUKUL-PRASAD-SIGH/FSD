const router = require('express').Router();
const Room = require('../models/Room');
const { protect } = require('../middleware/auth');
const { messageLimiter } = require('../middleware/security');
const { asyncRoute } = require('../utils/http');
const chat = require('../services/chat');
const teams = require('../services/teams');
const social = require('../services/social');
const { str } = require('../utils/sanitize');

const { fail } = social;
router.use(protect);

router.get('/rooms', asyncRoute(async (req, res) => {
  const rooms = await chat.listRooms(req.user._id);
  res.json({ rooms, unread: rooms.reduce((n, r) => n + r.unread, 0) });
}));

router.post('/rooms/dm', asyncRoute(async (req, res) => {
  const room = await chat.ensureDm(req.user._id, req.body?.userId);
  res.json({ roomId: String(room._id) });
}));

router.post('/rooms', asyncRoute(async (req, res) => {
  const name = str(req.body?.name, 80);
  if (name.length < 2) throw fail(400, 'Give the room a name (2 to 80 characters)');
  if ((await Room.countDocuments({ kind: 'group', createdBy: req.user._id })) >= 20) throw fail(400, 'You can own up to 20 private rooms');
  const room = await chat.createGroup(req.user, name);
  // optional first invitations (people you are connected with)
  for (const id of (Array.isArray(req.body?.invite) ? req.body.invite : []).slice(0, 20)) await teams.inviteToRoom(room, req.user, id).catch(() => {});
  res.status(201).json({ roomId: String(room._id) });
}));

router.get('/rooms/:id', asyncRoute(async (req, res) => res.json({ room: await chat.roomDetail(req.params.id, req.user._id) })));
router.get('/rooms/:id/messages', asyncRoute(async (req, res) => res.json({ messages: await chat.history(req.params.id, req.user._id, { before: req.query.before, limit: req.query.limit }) })));
// REST send keeps chat working when the live socket is unavailable (corporate proxies, reconnecting)
router.post('/rooms/:id/messages', messageLimiter, asyncRoute(async (req, res) => {
  res.status(201).json({ message: await chat.sendMessage({ roomId: req.params.id, userId: req.user._id, text: req.body?.text }) });
}));
router.post('/rooms/:id/read', asyncRoute(async (req, res) => { await chat.markRead(req.params.id, req.user._id); res.json({ ok: true }); }));

router.post('/rooms/:id/invite', asyncRoute(async (req, res) => {
  const room = await chat.loadRoomFor(req.params.id, req.user._id);
  res.json(await teams.inviteToRoom(room, req.user, req.body?.userId));
}));
router.post('/rooms/:id/leave', asyncRoute(async (req, res) => {
  const room = await chat.loadRoomFor(req.params.id, req.user._id);
  if (room.kind !== 'group') throw fail(400, room.kind === 'team' ? 'Leave the team to leave its room' : 'Direct messages cannot be left');
  if (room.members.find((m) => String(m.user) === String(req.user._id))?.role === 'owner') throw fail(400, 'Owners cannot leave. Delete the room instead.');
  await chat.removeMember(room._id, req.user._id); res.json({ ok: true });
}));
router.delete('/rooms/:id', asyncRoute(async (req, res) => {
  const room = await chat.loadRoomFor(req.params.id, req.user._id);
  if (room.kind !== 'group' || room.members.find((m) => String(m.user) === String(req.user._id))?.role !== 'owner') throw fail(403, 'Only the owner of a private room can delete it');
  await chat.deleteRoom(room._id); res.json({ ok: true });
}));

module.exports = router;

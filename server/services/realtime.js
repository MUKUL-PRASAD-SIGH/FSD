// Live channel (Socket.IO). REST remains the source of truth and works without it; sockets only make things instant.
//
// Security model (differs deliberately from the reference dashboard, which accepted unsigned base64 tokens and test tokens):
//   - the handshake token must be a valid HS256 JWT for an ACTIVE user whose tokenVersion still matches (same rule as REST)
//   - the server decides which channels a socket joins, from the database: `user:<id>` and `room:<id>` for rooms the user is a member of.
//     The client can never ask to join a room; sending/typing re-checks membership from the socket's own joined rooms
//   - per-socket token bucket limits message rate; payload size is capped by maxHttpBufferSize
//   - revoked sessions (password change, disable, sign-out-everywhere) disconnect immediately (see User model hooks)
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const User = require('../models/User');
const Room = require('../models/Room');
const { config } = require('../config/env');

let io = null;

const userRoom = (id) => `user:${id}`;
const roomChannel = (id) => `room:${id}`;

async function authenticate(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string' || !token) return next(new Error('unauthorized'));
    const { id, tv } = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    const user = await User.findById(id).select('name tokenVersion status');
    if (!user || user.status !== 'active' || user.tokenVersion !== tv) return next(new Error('unauthorized'));
    socket.data.userId = String(user._id);
    socket.data.name = user.name;
    return next();
  } catch { return next(new Error('unauthorized')); }
}

// 20 messages per 10 seconds per socket, refilling smoothly
function bucket(max = 20, perMs = 10000) {
  let tokens = max; let last = Date.now();
  return () => { const now = Date.now(); tokens = Math.min(max, tokens + ((now - last) / perMs) * max); last = now; if (tokens < 1) return false; tokens -= 1; return true; };
}

function init(httpServer) {
  if (io) return io;
  const chat = require('./chat'); // required lazily: chat -> realtime -> chat would otherwise be circular
  io = new Server(httpServer, {
    cors: { origin: (origin, cb) => cb(null, !origin || config.clientOrigins.includes(origin)), credentials: false },
    maxHttpBufferSize: 16 * 1024,
    pingInterval: 25000, pingTimeout: 20000,
    serveClient: false,
  });
  io.use(authenticate);
  io.on('connection', async (socket) => {
    const uid = socket.data.userId;
    const allowed = bucket();
    socket.join(userRoom(uid));
    try {
      const rooms = await Room.find({ 'members.user': uid }).select('_id').lean();
      for (const r of rooms) socket.join(roomChannel(r._id));
    } catch (e) { console.warn('realtime: could not join rooms', e.message); }
    socket.emit('ready', { userId: uid });

    socket.on('message:send', async (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        if (!allowed()) return reply({ ok: false, error: 'You are sending messages too fast. Slow down a little.' });
        const { roomId, text } = payload || {};
        if (typeof roomId !== 'string' || typeof text !== 'string') return reply({ ok: false, error: 'Invalid message' });
        const message = await chat.sendMessage({ roomId, userId: uid, text });
        reply({ ok: true, message });
      } catch (e) { reply({ ok: false, error: e.status && e.status < 500 ? e.message : 'Could not send the message' }); }
    });

    socket.on('typing', (payload) => {
      const roomId = payload?.roomId;
      if (typeof roomId !== 'string' || !socket.rooms.has(roomChannel(roomId))) return; // only rooms the server joined this socket to
      socket.to(roomChannel(roomId)).emit('typing', { roomId, userId: uid, name: socket.data.name, on: !!payload.on });
    });

    socket.on('room:read', async (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try { await chat.markRead(String(payload?.roomId || ''), uid); reply({ ok: true }); } catch { reply({ ok: false }); }
    });
  });
  return io;
}

// ---- helpers used by services (all no-ops when the socket server is not running, e.g. in REST-only tests)
const emitToUser = (userId, event, payload) => { if (io) io.to(userRoom(userId)).emit(event, payload); };
const emitToRoom = (roomId, event, payload) => { if (io) io.to(roomChannel(roomId)).emit(event, payload); };
const joinRoom = (userId, roomId) => { if (io) io.in(userRoom(userId)).socketsJoin(roomChannel(roomId)); };
const leaveRoom = (userId, roomId) => { if (io) io.in(userRoom(userId)).socketsLeave(roomChannel(roomId)); };
const dropRoom = (roomId) => { if (io) io.in(roomChannel(roomId)).socketsLeave(roomChannel(roomId)); };
const disconnectUser = (userId) => { if (io) io.in(userRoom(userId)).disconnectSockets(true); };
const online = (userId) => (io ? (io.sockets.adapter.rooms.get(userRoom(userId))?.size || 0) > 0 : false);
const close = async () => { if (io) { await new Promise((r) => io.close(r)); io = null; } };

module.exports = { init, emitToUser, emitToRoom, joinRoom, leaveRoom, dropRoom, disconnectUser, online, close };

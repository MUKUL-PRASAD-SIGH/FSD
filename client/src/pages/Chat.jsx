import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useRealtime } from '../realtime.jsx';
import { useToast } from '../toast.jsx';
import ChatPane from '../ChatPane.jsx';

const ICON = { dm: '💬', team: '👥', group: '🔒' };
const ago = (d) => { const m = Math.round((Date.now() - new Date(d)) / 60000); return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); };

// Room header: who is in the conversation and what you can do about it
function RoomHeader({ roomId, onGone }) {
  const { user } = useAuth();
  const toast = useToast();
  const [room, setRoom] = useState(null);
  const [conns, setConns] = useState([]);
  const [pick, setPick] = useState('');
  const load = useCallback(() => api.room(roomId).then((r) => setRoom(r.room)).catch(() => setRoom(null)), [roomId]);
  useEffect(() => { load(); window.addEventListener('hackelite:rooms', load); return () => window.removeEventListener('hackelite:rooms', load); }, [load]);
  useEffect(() => { api.overview().then((o) => setConns(o.connections)).catch(() => {}); }, [roomId]);
  if (!room) return <div className="room-head"><strong>…</strong></div>;
  const owner = room.members.find((m) => m.role === 'owner')?.id === user.id;
  const invitable = conns.filter((c) => !room.members.some((m) => m.id === c.id));
  const title = room.kind === 'dm' ? room.members.find((m) => m.id !== user.id)?.name || 'Conversation' : room.name;
  const run = async (fn, ok) => { try { await fn(); if (ok) toast(ok, 'good'); } catch (e) { toast(e.message, 'err'); } };
  return (
    <div className="room-head">
      <div>
        <strong>{ICON[room.kind]} {title}</strong>
        <span className="muted small"> · {room.members.length} member{room.members.length === 1 ? '' : 's'}: {room.members.map((m) => m.name.split(' ')[0]).join(', ')}</span>
        {room.kind === 'team' && room.team && <> · <Link to={`/teams/${room.team}`} className="small">Open team</Link></>}
      </div>
      {room.kind === 'group' && (
        <div className="row">
          {owner && invitable.length > 0 && (
            <>
              <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Invite a connection"><option value="">Invite a connection…</option>{invitable.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <button className="btn" disabled={!pick} onClick={() => run(async () => { await api.inviteToRoom(roomId, pick); setPick(''); }, 'Invitation sent')}>Invite</button>
            </>
          )}
          {owner ? <button className="link small" onClick={() => window.confirm('Delete this room and all its messages?') && run(async () => { await api.deleteRoom(roomId); onGone(); })}>Delete room</button>
            : <button className="link small" onClick={() => run(async () => { await api.leaveRoom(roomId); onGone(); }, 'You left the room')}>Leave room</button>}
        </div>
      )}
    </div>
  );
}

export default function Chat() {
  const { roomId } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { refresh } = useRealtime();
  const [rooms, setRooms] = useState(null);
  const [conns, setConns] = useState([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [invite, setInvite] = useState([]);

  const load = useCallback(() => api.chatRooms().then((r) => setRooms(r.rooms)).catch(() => setRooms([])), []);
  useEffect(() => {
    load(); api.overview().then((o) => setConns(o.connections)).catch(() => {});
    const t = setInterval(load, 20000);
    const reload = () => load();
    window.addEventListener('hackelite:rooms', reload); window.addEventListener('hackelite:notification', reload);
    return () => { clearInterval(t); window.removeEventListener('hackelite:rooms', reload); window.removeEventListener('hackelite:notification', reload); };
  }, [load]);
  // keep the sidebar's last message/unread fresh as live messages arrive
  const { socket } = useRealtime();
  useEffect(() => { if (!socket) return undefined; const h = () => load(); socket.on('message:new', h); return () => socket.off('message:new', h); }, [socket, load]);

  useEffect(() => { if (!roomId && rooms?.length && window.innerWidth > 800) nav(`/chat/${rooms[0].id}`, { replace: true }); }, [rooms, roomId, nav]);

  async function startDm(userId) { if (!userId) return; try { const r = await api.openDm(userId); await load(); nav(`/chat/${r.roomId}`); } catch (e) { toast(e.message, 'err'); } }
  async function createRoom(e) {
    e.preventDefault();
    try { const r = await api.createRoom({ name, invite }); setCreating(false); setName(''); setInvite([]); await load(); nav(`/chat/${r.roomId}`); toast(invite.length ? 'Room created and invitations sent' : 'Private room created', 'good'); refresh(); } catch (err) { toast(err.message, 'err'); }
  }

  return (
    <>
      <div className="row-between"><h1>Chat</h1><button className="btn primary" onClick={() => setCreating(!creating)}>{creating ? 'Cancel' : '+ Private room'}</button></div>
      {creating && (
        <form className="panel" onSubmit={createRoom}>
          <label>Room name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekend build crew" maxLength={80} required minLength={2} /></label>
          <fieldset><legend>Invite people you’re connected with (they must accept)</legend>
            {conns.length ? <div className="chips">{conns.map((c) => <button type="button" key={c.id} className={`chip ${invite.includes(c.id) ? 'on' : ''}`} aria-pressed={invite.includes(c.id)} onClick={() => setInvite(invite.includes(c.id) ? invite.filter((x) => x !== c.id) : [...invite, c.id])}>{c.name}</button>)}</div> : <p className="muted small">No connections yet. <Link to="/network">Find people</Link> first, or create the room now and invite later.</p>}
          </fieldset>
          <button className="btn primary" disabled={name.trim().length < 2}>Create private room</button>
        </form>
      )}
      <div className="chat-layout">
        <aside className="rooms" aria-label="Conversations">
          <div className="row">
            <select aria-label="Start a direct message" value="" onChange={(e) => startDm(e.target.value)}>
              <option value="">{conns.length ? 'New message to…' : 'Connect with people to message them'}</option>
              {conns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {rooms === null && <p className="muted small">Loading…</p>}
          {rooms?.length === 0 && <p className="muted small">No conversations yet. Message a connection, create a private room, or open a team room.</p>}
          {rooms?.map((r) => (
            <button key={r.id} className={`room ${r.id === roomId ? 'on' : ''}`} onClick={() => nav(`/chat/${r.id}`)} aria-current={r.id === roomId}>
              <span className="ico" aria-hidden="true">{ICON[r.kind]}</span>
              <span className="meta2"><strong>{r.name}</strong><span className="muted small">{r.lastMessageText ? `${r.lastMessageMine ? 'You: ' : ''}${r.lastMessageText}` : 'No messages yet'}</span></span>
              <span className="side"><span className="muted small">{ago(r.lastMessageAt)}</span>{r.unread > 0 && <b className="badge static">{r.unread > 9 ? '9+' : r.unread}</b>}</span>
            </button>
          ))}
        </aside>
        <section className="convo">
          {roomId ? <><RoomHeader roomId={roomId} onGone={() => { load(); nav('/chat'); }} /><ChatPane roomId={roomId} /></> : <div className="empty">Select a conversation to start chatting.</div>}
        </section>
      </div>
    </>
  );
}

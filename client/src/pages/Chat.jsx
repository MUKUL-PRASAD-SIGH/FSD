import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useRealtime } from '../realtime.jsx';
import { useToast } from '../toast.jsx';
import ChatPane from '../ChatPane.jsx';
import { Avatar, Icon, hueOf } from '../ui.jsx';
import '../chat.css';

const KIND = { dm: 'Direct', team: 'Team', group: 'Room' };
const ago = (d) => { const m = Math.round((Date.now() - new Date(d)) / 60000); return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); };

// Round avatar for people, rounded-square glyph for teams and rooms
function RoomAvatar({ kind, name, size = 46 }) {
  if (kind === 'dm') return <Avatar name={name} size={size} />;
  const g = ['#145BFF', '#22C8FF', '#C6FF00'];
  const h = hueOf(name);
  return <span className="ct-ra" style={{ width: size, height: size, background: `linear-gradient(135deg, ${g[h % 3]}, ${g[(h + 1) % 3]})`, color: (h % 3 === 2 || (h + 1) % 3 === 2) ? '#0a1400' : '#fff' }} aria-hidden="true"><Icon name={kind === 'team' ? 'people' : 'hash'} size="1.35em" /></span>;
}

// Room header: who is in the conversation and what you can do about it
function RoomHeader({ roomId, onGone, onBack }) {
  const { user } = useAuth();
  const toast = useToast();
  const [room, setRoom] = useState(null);
  const [conns, setConns] = useState([]);
  const [pick, setPick] = useState('');
  const load = useCallback(() => api.room(roomId).then((r) => setRoom(r.room)).catch(() => setRoom(null)), [roomId]);
  useEffect(() => { load(); window.addEventListener('hackelite:rooms', load); return () => window.removeEventListener('hackelite:rooms', load); }, [load]);
  useEffect(() => { api.overview().then((o) => setConns(o.connections)).catch(() => {}); }, [roomId]);
  if (!room) return <div className="room-head"><button className="ct-back" onClick={onBack} aria-label="Back to conversations">‹</button><strong>…</strong></div>;
  const owner = room.members.find((m) => m.role === 'owner')?.id === user.id;
  const invitable = conns.filter((c) => !room.members.some((m) => m.id === c.id));
  const title = room.kind === 'dm' ? room.members.find((m) => m.id !== user.id)?.name || 'Conversation' : room.name;
  const run = async (fn, ok) => { try { await fn(); if (ok) toast(ok, 'good'); } catch (e) { toast(e.message, 'err'); } };
  return (
    <div className="room-head">
      <button className="ct-back" onClick={onBack} aria-label="Back to conversations">‹</button>
      <RoomAvatar kind={room.kind} name={title} size={42} />
      <div className="ct-head-main">
        <strong>{title}</strong>
        <span className="muted small">{room.kind === 'dm' ? 'Direct message' : `${room.members.length} member${room.members.length === 1 ? '' : 's'}: ${room.members.map((m) => m.name.split(' ')[0]).join(', ')}`}{room.kind === 'team' && room.team && <> · <Link to={`/teams/${room.team}`} className="small">Open team</Link></>}</span>
      </div>
      {room.kind !== 'dm' && <div className="ct-stack">{room.members.slice(0, 4).map((m) => <Avatar key={m.id} name={m.name} size={28} />)}{room.members.length > 4 && <span className="ct-more">+{room.members.length - 4}</span>}</div>}
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
  const { isPro } = useAuth();
  const { roomId } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { refresh, connected } = useRealtime();
  const [rooms, setRooms] = useState(null);
  const [conns, setConns] = useState([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [invite, setInvite] = useState([]);
  const [tab, setTab] = useState('all');
  const [find, setFind] = useState('');

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

  const shown = useMemo(() => (rooms || []).filter((r) => (tab === 'all' || r.kind === tab) && r.name.toLowerCase().includes(find.toLowerCase())), [rooms, tab, find]);
  const unread = (rooms || []).reduce((a, r) => a + (r.unread || 0), 0);

  return (
    <div className={`ct ${roomId ? 'in-room' : ''}`}>
      <aside className="ct-side" aria-label="Conversations">
        <div className="ct-side-h">
          <h1>Messages {unread > 0 && <b>{unread > 99 ? '99+' : unread}</b>}</h1>
          <span className={`ct-live ${connected ? 'on' : ''}`} title={connected ? 'Connected: messages arrive instantly' : 'Reconnecting: messages still send'}><i />{connected ? 'Live' : 'Reconnecting'}</span>
        </div>
        <div className="ct-new">
          <select aria-label="Start a direct message" value="" onChange={(e) => startDm(e.target.value)}>
            <option value="">{conns.length ? '✎ New message to…' : 'Connect with people to message them'}</option>
            {conns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn primary" onClick={() => setCreating(!creating)} aria-expanded={creating}>{creating ? '×' : '+ Room'}</button>
        </div>
        {creating && !isPro && (
          <div className="ct-upsell">
            <b>Private rooms are a Pro feature <span className="pill">Pro</span></b>
            <p>Pro members can create invite-only rooms for their crew. You can still join any team or private room you are invited to, and chat there, for free. Direct messages with your connections are free. <Link to="/plan">Unlock Pro</Link></p>
          </div>
        )}
        {creating && isPro && (
          <form className="ct-create" onSubmit={createRoom}>
            <label>Room name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekend build crew" maxLength={80} required minLength={2} /></label>
            <fieldset><legend>Invite people you’re connected with (they must accept)</legend>
              {conns.length ? <div className="chips">{conns.map((c) => <button type="button" key={c.id} className={`chip ${invite.includes(c.id) ? 'on' : ''}`} aria-pressed={invite.includes(c.id)} onClick={() => setInvite(invite.includes(c.id) ? invite.filter((x) => x !== c.id) : [...invite, c.id])}>{c.name}</button>)}</div> : <p className="muted small">Connect with people first, then you can invite them.</p>}
            </fieldset>
            <button className="btn primary" disabled={name.trim().length < 2}>Create private room</button>
          </form>
        )}
        <label className="ct-find"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg><input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Search conversations" aria-label="Search conversations" /></label>
        <div className="ct-tabs" role="tablist" aria-label="Filter conversations">{[['all', 'All'], ['dm', 'Direct'], ['team', 'Teams'], ['group', 'Rooms']].map(([v, l]) => <button key={v} role="tab" aria-selected={tab === v} className={tab === v ? 'on' : ''} onClick={() => setTab(v)}>{l}</button>)}</div>
        <div className="ct-rooms">
          {rooms === null && [0, 1, 2, 3].map((k) => <div key={k} className="ct-skel" />)}
          {rooms?.length === 0 && <p className="ct-none">No conversations yet. Message a connection, create a private room, or open a team room.</p>}
          {rooms?.length > 0 && !shown.length && <p className="ct-none">No conversations match.</p>}
          {shown.map((r, i) => (
            <button key={r.id} style={{ '--i': Math.min(i, 8) }} className={`room ${r.id === roomId ? 'on' : ''} ${r.unread > 0 ? 'unread' : ''}`} onClick={() => nav(`/chat/${r.id}`)} aria-current={r.id === roomId}>
              <RoomAvatar kind={r.kind} name={r.name} />
              <span className="meta2"><strong>{r.name}</strong><span className="prev"><em>{KIND[r.kind]}</em>{r.lastMessageText ? `${r.lastMessageMine ? 'You: ' : ''}${r.lastMessageText}` : 'No messages yet'}</span></span>
              <span className="side"><span className="muted small">{ago(r.lastMessageAt)}</span>{r.unread > 0 && <b className="badge static">{r.unread > 9 ? '9+' : r.unread}</b>}</span>
            </button>
          ))}
        </div>
      </aside>
      <section className="ct-convo convo">
        {roomId ? <><RoomHeader roomId={roomId} onBack={() => nav('/chat')} onGone={() => { load(); nav('/chat'); }} /><ChatPane roomId={roomId} /></> : (
          <div className="ct-blank"><div className="ct-blank-art" aria-hidden="true"><i /><i /><i /></div><h2>Select a conversation</h2><p>Pick someone from the list, or start a new message to a connection.</p></div>
        )}
      </section>
    </div>
  );
}

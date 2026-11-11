import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { useAuth } from './auth.jsx';
import { useRealtime } from './realtime.jsx';

const timeOf = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
const dayOf = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

// A live conversation. History loads over REST; new messages arrive over the socket. Sending goes through the socket (instant
// ack) and falls back to REST if the socket is down. Message text is rendered as plain text by React, never as HTML.
export default function ChatPane({ roomId, empty = 'Say hello 👋' }) {
  const { user } = useAuth();
  const { socket, connected, setActiveRoom, refresh } = useRealtime();
  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [typing, setTyping] = useState('');
  const [sending, setSending] = useState(false);
  const box = useRef(null);
  const stick = useRef(true);
  const lastTyping = useRef(0);
  const typingTimer = useRef(null);

  const add = useCallback((m) => setMsgs((l) => (l.some((x) => x.id === m.id) ? l : [...l, m])), []);

  useEffect(() => {
    let live = true;
    setMsgs([]); setLoading(true); setError(''); setTyping(''); stick.current = true;
    setActiveRoom(roomId);
    api.roomMessages(roomId).then((r) => { if (!live) return; setMsgs(r.messages); setMore(r.messages.length >= 40); }).catch((e) => live && setError(e.message)).finally(() => live && setLoading(false));
    api.markRead(roomId).then(refresh).catch(() => {});
    return () => { live = false; setActiveRoom(null); };
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!socket) return undefined;
    const onMsg = (m) => { if (m.roomId !== roomId) return; add(m); if (m.senderId !== user.id) socket.emit('room:read', { roomId }, () => refresh()); };
    const onTyping = (t) => {
      if (t.roomId !== roomId || t.userId === user.id) return;
      setTyping(t.on ? `${t.name.split(' ')[0]} is typing…` : '');
      clearTimeout(typingTimer.current); if (t.on) typingTimer.current = setTimeout(() => setTyping(''), 3500);
    };
    socket.on('message:new', onMsg); socket.on('typing', onTyping);
    return () => { socket.off('message:new', onMsg); socket.off('typing', onTyping); clearTimeout(typingTimer.current); };
  }, [socket, roomId, user.id, add, refresh]);

  useEffect(() => { const el = box.current; if (el && stick.current) el.scrollTop = el.scrollHeight; }, [msgs, typing]);
  const onScroll = () => { const el = box.current; if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; };

  async function older() {
    const first = msgs[0]; if (!first) return;
    const el = box.current; const prev = el.scrollHeight;
    const r = await api.roomMessages(roomId, first.createdAt);
    stick.current = false;
    setMsgs((l) => [...r.messages.filter((m) => !l.some((x) => x.id === m.id)), ...l]);
    setMore(r.messages.length >= 40);
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight - prev; });
  }

  async function send(e) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true); setError('');
    try {
      if (socket && connected) {
        const ack = await new Promise((resolve) => { const t = setTimeout(() => resolve({ ok: false, error: 'timeout' }), 6000); socket.emit('message:send', { roomId, text: body }, (a) => { clearTimeout(t); resolve(a); }); });
        if (!ack.ok && ack.error !== 'timeout') throw new Error(ack.error);
        if (ack.ok) add(ack.message); else add((await api.sendMessage(roomId, body)).message);
      } else add((await api.sendMessage(roomId, body)).message);
      stick.current = true; setText(''); socket?.emit('typing', { roomId, on: false });
    } catch (err) { setError(err.message); } finally { setSending(false); }
  }

  function onChange(v) {
    setText(v);
    if (socket && connected && Date.now() - lastTyping.current > 2500) { lastTyping.current = Date.now(); socket.emit('typing', { roomId, on: true }); }
  }

  let lastDay = '';
  return (
    <div className="chatpane">
      <div className="msgs" ref={box} onScroll={onScroll} aria-live="polite" aria-label="Messages">
        {more && <button className="link small center-self" onClick={older}>Load earlier messages</button>}
        {loading && <p className="muted small center-self">Loading…</p>}
        {!loading && !msgs.length && !error && <p className="muted center-self">{empty}</p>}
        {msgs.map((m, i) => {
          const mine = m.senderId === user.id;
          const d = dayOf(m.createdAt); const showDay = d !== lastDay; lastDay = d;
          const showName = !mine && (i === 0 || msgs[i - 1].senderId !== m.senderId || showDay);
          return (
            <div key={m.id}>
              {showDay && <p className="day small muted">{d}</p>}
              <div className={`msg ${mine ? 'mine' : ''}`}>
                {showName && <span className="who small">{m.senderName || 'Member'}</span>}
                <p>{m.text}</p>
                <span className="when">{timeOf(m.createdAt)}</span>
              </div>
            </div>
          );
        })}
        {typing && <p className="small muted typing">{typing}</p>}
      </div>
      {error && <p className="error small pad-x" role="alert">{error}</p>}
      <form className="composer" onSubmit={send}>
        <textarea
          value={text} rows={1} maxLength={2000} placeholder={connected ? 'Write a message…' : 'Write a message (reconnecting, will send normally)…'} aria-label="Message"
          onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button className="btn primary" disabled={!text.trim() || sending}>Send</button>
      </form>
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export function useNotifications(enabled) {
  const [data, setData] = useState({ unread: 0, notifications: [] });
  const load = useCallback(() => api.notifications().then(setData).catch(() => {}), []);
  useEffect(() => {
    if (!enabled) return;
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [enabled, load]);
  return [data, load];
}

export function Bell({ data, reload }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  async function click(n) { setOpen(false); if (!n.read) await api.readOne(n.id).catch(() => {}); reload(); nav(n.link || '/notifications'); }
  return (
    <div className="bell">
      <button className="btn ghost icon" aria-label={`Notifications, ${data.unread} unread`} aria-expanded={open} onClick={() => setOpen(!open)}>
        🔔{data.unread > 0 && <b className="badge">{data.unread > 9 ? '9+' : data.unread}</b>}
      </button>
      {open && (
        <div className="drop" role="menu">
          {data.notifications.slice(0, 6).map((n) => (
            <button key={n.id} role="menuitem" className={`note ${n.read ? '' : 'unread'}`} onClick={() => click(n)}>
              <strong>{n.title}</strong>{n.body && <span className="small muted">{n.body}</span>}
            </button>
          ))}
          {!data.notifications.length && <p className="muted small pad">You’re all caught up.</p>}
          <Link to="/notifications" className="small pad" onClick={() => setOpen(false)}>See all</Link>
        </div>
      )}
    </div>
  );
}

export default function Notifications() {
  const [data, reload] = useNotifications(true);
  const nav = useNavigate();
  return (
    <>
      <div className="row-between">
        <h1>Notifications</h1>
        {data.unread > 0 && <button className="btn ghost" onClick={async () => { await api.readAll(); reload(); }}>Mark all read</button>}
      </div>
      <p className="muted small">We alert you about new listings that match your profile and about saved deadlines in the next 48 hours. Tune this on your <Link to="/profile">profile</Link>.</p>
      <ul className="notes">
        {data.notifications.map((n) => (
          <li key={n.id}>
            <button className={`note ${n.read ? '' : 'unread'}`} onClick={async () => { if (!n.read) await api.readOne(n.id).catch(() => {}); reload(); nav(n.link || '/'); }}>
              <strong>{n.title}</strong>{n.body && <span className="muted small">{n.body}</span>}
              <span className="small muted">{new Date(n.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </button>
          </li>
        ))}
      </ul>
      {!data.notifications.length && <div className="empty">No notifications yet. They appear when new events match your interests.</div>}
    </>
  );
}

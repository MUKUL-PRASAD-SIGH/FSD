import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api, getToken } from './api.js';
import { useAuth } from './auth.jsx';
import { useToast } from './toast.jsx';

// One live connection per signed-in user. It delivers notifications and chat messages instantly and keeps the nav badges
// (unread messages, pending requests/invitations) fresh. REST stays the source of truth: if the socket is down, everything
// still works, it just updates on the next action or reload.
const Ctx = createContext({ socket: null, connected: false, counts: { chat: 0, pending: 0 }, refresh: () => {}, setActiveRoom: () => {} });
export const useRealtime = () => useContext(Ctx);

export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [counts, setCounts] = useState({ chat: 0, pending: 0 });
  const active = useRef(null);
  const timer = useRef(null);

  const refresh = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const [rooms, ov] = await Promise.all([api.chatRooms(), api.overview()]);
        setCounts({ chat: rooms.unread, pending: ov.incoming.length + ov.invites.incoming.length });
      } catch { /* signed out or offline */ }
    }, 250);
  }, []);

  useEffect(() => {
    if (!user) { setSocket(null); setConnected(false); setCounts({ chat: 0, pending: 0 }); return undefined; }
    const s = io({ auth: { token: getToken() }, transports: ['websocket'], reconnectionDelayMax: 8000 });
    setSocket(s);
    s.on('ready', () => { setConnected(true); refresh(); });
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', () => setConnected(false));
    s.on('notification:new', (n) => { toast(n.title, 'good'); window.dispatchEvent(new CustomEvent('hackelite:notification')); refresh(); });
    s.on('message:new', (m) => { if (m.roomId !== active.current) refresh(); });
    s.on('room:added', () => { window.dispatchEvent(new CustomEvent('hackelite:rooms')); refresh(); });
    s.on('room:removed', () => { window.dispatchEvent(new CustomEvent('hackelite:rooms')); refresh(); });
    refresh();
    return () => { s.removeAllListeners(); s.close(); clearTimeout(timer.current); };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const setActiveRoom = useCallback((id) => { active.current = id; }, []);
  return <Ctx.Provider value={{ socket, connected, counts, refresh, setActiveRoom }}>{children}</Ctx.Provider>;
}

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from './api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!getToken());
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    if (!getToken()) return;
    api.me().then((r) => setUser(r.user)).catch(() => setToken(null)).finally(() => setReady(true));
  }, []);

  const finish = useCallback((r) => { setToken(r.token); setUser(r.user); setAuthOpen(false); }, []);
  const value = {
    user, ready, setUser, authOpen, openAuth: () => setAuthOpen(true), closeAuth: () => setAuthOpen(false),
    login: async (b) => finish(await api.login(b)),
    register: async (b) => finish(await api.register(b)),
    logout: () => { setToken(null); setUser(null); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

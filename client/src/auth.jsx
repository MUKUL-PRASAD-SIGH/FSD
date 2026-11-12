import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from './api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!getToken());
  const [cfg, setCfg] = useState({ googleClientId: null, passwordMinLength: 10 });

  const signOut = useCallback(() => { setToken(null); setUser(null); }, []);

  useEffect(() => {
    setUnauthorizedHandler(signOut);
    api.config().then(setCfg).catch(() => {});
    if (!getToken()) return;
    api.me().then((r) => setUser(r.user)).catch(() => setToken(null)).finally(() => setReady(true));
  }, [signOut]);

  // Role and account changes made on another device must update this browser's navigation and guards too.
  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    const sync = () => api.me().then((r) => { if (active) setUser(r.user); }).catch(() => {});
    const onFocus = () => { if (document.visibilityState === 'visible') sync(); };
    const poll = setInterval(sync, 60000);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => { active = false; clearInterval(poll); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, [user?.id]);

  const finish = useCallback((r) => { setToken(r.token); setUser(r.user); return r; }, []);
  const refresh = useCallback(() => api.me().then((r) => setUser(r.user)), []);

  const value = {
    user, ready, cfg, setUser, refresh,
    isPro: user?.plan?.tier === 'pro' || user?.role === 'admin',
    login: async (b) => finish(await api.login(b)),
    register: async (b) => finish(await api.register(b)),
    google: async (b) => finish(await api.google(b)),
    adopt: finish,
    logout: signOut,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

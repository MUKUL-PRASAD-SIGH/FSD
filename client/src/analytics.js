import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from './api.js';

// Product analytics. Fire-and-forget: tracking never blocks or breaks the UI.
// - page views on every route change (path only, never the query string)
// - time on platform: a heartbeat every 30 s, counting only while the tab is visible and the user is signed in
// Users can turn off personal tracking in Profile → Privacy; the server then counts their events anonymously and records no time.
const BEAT_MS = 30000;
const quiet = (p) => p?.catch?.(() => {});

export const track = (type, extra = {}) => quiet(api.track({ type, path: window.location.pathname, ...extra }));

export function useAnalytics(user) {
  const loc = useLocation();
  useEffect(() => { track('page_view'); }, [loc.pathname]);

  const visibleSince = useRef(null);
  useEffect(() => {
    if (!user) return undefined;
    const visible = () => document.visibilityState === 'visible';
    visibleSince.current = visible() ? Date.now() : null;
    const flush = () => {
      if (visibleSince.current == null) return;
      const seconds = Math.round((Date.now() - visibleSince.current) / 1000);
      visibleSince.current = visible() ? Date.now() : null;
      if (seconds >= 1) quiet(api.heartbeat(Math.min(seconds, 60)));
    };
    const onVisibility = () => { if (visible()) visibleSince.current = Date.now(); else flush(); };
    const t = setInterval(flush, BEAT_MS);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => { flush(); clearInterval(t); document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('pagehide', flush); };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
}

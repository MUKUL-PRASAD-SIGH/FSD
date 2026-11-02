import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ListingCard, Empty, inr } from '../components.jsx';

const TYPES = ['', 'HACKATHON', 'CASE STUDY', 'CONTEST', 'COMPETITION', 'DESIGN', 'INNOVATION'];

export default function Home() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [f, setF] = useState({ q: '', type: '', mode: '', free: false, closing: '', sort: 'deadline' });
  const [data, setData] = useState({ listings: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState(new Set());
  const [limit, setLimit] = useState(24);
  const [error, setError] = useState('');

  useEffect(() => { api.stats().then(setStats).catch(() => {}); }, []);
  useEffect(() => {
    if (!user) { setSavedIds(new Set()); return; }
    api.saved().then((r) => setSavedIds(new Set(r.saved.map((s) => s.listing.id)))).catch(() => {});
  }, [user]);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true); setError('');
      const p = { limit, sort: f.sort };
      if (f.q) p.q = f.q; if (f.type) p.type = f.type; if (f.mode) p.mode = f.mode;
      if (f.free) p.free = 'true'; if (f.closing) p.closing = f.closing;
      api.listings(p).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [f, limit]);

  const set = (k, v) => { setF((o) => ({ ...o, [k]: v })); setLimit(24); };

  return (
    <>
      <section className="hero">
        <h1>Every open hackathon and competition, ranked for you.</h1>
        <p className="muted">Live listings from the platforms they run on, linked straight to the organiser. Upload your resume and we’ll tell you which ones fit — and why.</p>
        <div className="hero-cta">
          <Link className="btn primary" to="/for-you">{user ? 'See my picks' : 'Get picks from my resume'}</Link>
          <Link className="btn ghost" to="/ask">Ask in plain English</Link>
        </div>
        {stats && (
          <dl className="stats">
            <div><dt>open now</dt><dd>{stats.open}</dd></div>
            <div><dt>closing in 7 days</dt><dd>{stats.closingWeek}</dd></div>
            <div><dt>prize money listed</dt><dd>{inr(stats.prizeInr)}</dd></div>
            <div><dt>platforms</dt><dd>{stats.platforms.length}</dd></div>
          </dl>
        )}
      </section>

      <section aria-label="Filters" className="filters">
        <input type="search" placeholder="Search title, organiser, theme…" value={f.q} onChange={(e) => set('q', e.target.value)} aria-label="Search" />
        <select value={f.type} onChange={(e) => set('type', e.target.value)} aria-label="Type">
          {TYPES.map((t) => <option key={t} value={t}>{t ? t.toLowerCase() : 'all types'}</option>)}
        </select>
        <select value={f.mode} onChange={(e) => set('mode', e.target.value)} aria-label="Mode">
          <option value="">any mode</option><option value="ONLINE">online</option><option value="OFFLINE">in person</option><option value="HYBRID">hybrid</option>
        </select>
        <select value={f.sort} onChange={(e) => set('sort', e.target.value)} aria-label="Sort">
          <option value="deadline">soonest deadline</option><option value="prize">biggest prize</option><option value="popular">most registered</option>
        </select>
        <label className="chk"><input type="checkbox" checked={f.free} onChange={(e) => set('free', e.target.checked)} /> free</label>
        <label className="chk"><input type="checkbox" checked={f.closing === 'week'} onChange={(e) => set('closing', e.target.checked ? 'week' : '')} /> closing this week</label>
      </section>

      {error && <p className="error">{error}</p>}
      <p className="muted small" aria-live="polite">{loading ? 'Loading…' : `${data.total} listing${data.total === 1 ? '' : 's'}`}</p>
      <div className="grid">
        {data.listings.map((l) => <ListingCard key={l.id} item={l} saved={savedIds.has(l.id)} />)}
      </div>
      {!loading && !data.listings.length && <Empty>Nothing matches those filters. Loosen one and try again.</Empty>}
      {data.listings.length < data.total && <button className="btn ghost center" onClick={() => setLimit(limit + 24)}>Show more</button>}
    </>
  );
}

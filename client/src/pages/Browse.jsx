import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { track } from '../analytics.js';
import { useAuth } from '../auth.jsx';
import { Details, KIND, closes, prizeText, useListingActions } from '../components.jsx';
import { CountUp } from '../ui.jsx';
import './browse.css';

const CATS = [
  ['', 'All', '◎'], ['HACKATHON', 'Hackathons', '⌘'], ['CODING', 'Coding', '</>'], ['DESIGN', 'Design', '✎'], ['CASE STUDY', 'Case studies', '▤'],
  ['COMPETITION', 'Competitions', '♛'], ['QUIZ', 'Quiz', '?'], ['INNOVATION', 'Innovation', '✦'], ['CONTEST', 'Contests', '⚑'],
];
const MODES = [['', 'Any'], ['ONLINE', 'Online'], ['OFFLINE', 'In person'], ['HYBRID', 'Hybrid']];
const hue = (t = '') => ({ HACKATHON: 'cobalt', CODING: 'cyan', DESIGN: 'lime', 'CASE STUDY': 'cyan', COMPETITION: 'lime', QUIZ: 'cobalt', INNOVATION: 'lime' }[t] || 'cobalt');
const EMPTY = { q: '', type: '', platform: '', mode: '', free: false, closing: '', sort: 'deadline' };

// One opportunity. The summary is always visible; skills, themes and actions slide up on hover or focus
// (and are always shown on touch screens). "Details" expands the full facts, calendar and register link.
function DiscoveryCard({ item, saved, i, list }) {
  const { isSaved, busy, toggleSave, registered } = useListingActions(item, saved, undefined, '/browse');
  const [more, setMore] = useState(false);
  const c = closes(item.deadline);
  const prize = prizeText(item.prize);
  const kind = KIND[item.deadlineKind] || 'closes';
  const chips = [...new Set([...(item.skills || []), ...(item.tags || [])])].slice(0, 5);
  return (
    <article className={`bw-card ${hue(item.type)} ${more ? 'open' : ''} ${list ? 'row' : ''}`} style={{ '--i': Math.min(i, 14) }}>
      <header>
        <span className="bw-type">{item.type.toLowerCase()}</span>
        <span className={`bw-due ${c.tone}`} title={`${kind} ${new Date(item.deadline).toLocaleString('en-IN')}`}><i />{c.tone ? c.text : `${kind === 'starts' ? 'starts' : 'closes'} ${c.text}`}</span>
        <button className={`bw-save ${isSaved ? 'on' : ''}`} onClick={toggleSave} disabled={busy} aria-pressed={isSaved} aria-label={isSaved ? `Unsave ${item.title}` : `Save ${item.title}`}>{isSaved ? '★' : '☆'}</button>
      </header>
      <h3><Link to={`/listing/${item.id}`}>{item.title}</Link></h3>
      <p className="bw-org">{item.organiser || 'Organiser'} · {item.platform}{item.alsoOn?.length ? ` +${item.alsoOn.length}` : ''}</p>
      <div className="bw-facts">
        <span className="bw-prize"><small>prize</small><b>{prize ? prize.text : '—'}</b></span>
        <span><small>mode</small><b>{item.mode.toLowerCase()}{item.city ? ` · ${item.city}` : ''}</b></span>
        <span><small>entry</small><b>{/free/i.test(item.fee) ? 'free' : item.fee}</b></span>
        {item.teamMax ? <span><small>team</small><b>{item.teamMin || 1}–{item.teamMax}</b></span> : null}
      </div>
      <div className="bw-reveal">
        {chips.length > 0 && <p className="bw-chips">{chips.map((s) => <span key={s}>{s}</span>)}</p>}
        <div className="bw-actions">
          <button className="btn ghost" onClick={() => setMore(!more)} aria-expanded={more}>{more ? 'Hide details' : 'Details'}</button>
          <a className="btn primary" href={item.url} target="_blank" rel="noreferrer noopener" onClick={registered}>Register ↗</a>
        </div>
      </div>
      {more && <Details item={item} prize={prize} kind={kind} onRegister={registered} />}
    </article>
  );
}

function CloseCard({ item }) {
  const c = closes(item.deadline);
  const prize = prizeText(item.prize);
  return (
    <Link to={`/listing/${item.id}`} className={`bw-soon ${c.tone}`}>
      <span className="bw-soon-due">{c.text}</span>
      <b>{item.title}</b>
      <small>{prize ? prize.text : item.platform}</small>
    </Link>
  );
}

function Radar({ onClear, filtered }) {
  return (
    <div className="bw-empty">
      <div className="bw-radar" aria-hidden="true"><i /><i /><i /><b /></div>
      <h2>Nothing in range</h2>
      <p>{filtered ? 'No opportunity matches those filters. Widen the search or clear a filter.' : 'No open opportunities right now. Check back after the next refresh.'}</p>
      {filtered && <button className="btn primary" onClick={onClear}>Clear filters</button>}
    </div>
  );
}

function Scanning() {
  return <div className="bw-grid" aria-hidden="true">{Array.from({ length: 6 }, (_, k) => <div key={k} className="bw-card bw-skel" style={{ '--i': k }}><i /><i /><i /><i /></div>)}<span className="visually-hidden">Scanning for opportunities…</span></div>;
}

export default function Browse() {
  const { user } = useAuth();
  const [sp] = useSearchParams();
  const [stats, setStats] = useState(null);
  const [f, setF] = useState({ ...EMPTY, q: sp.get('q') || '', type: (sp.get('type') || '').toUpperCase() });
  const [data, setData] = useState({ listings: [], total: 0 });
  const [soon, setSoon] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState(new Set());
  const [limit, setLimit] = useState(24);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [list, setList] = useState(false);
  const rail = useRef(null);
  const [thumb, setThumb] = useState({ x: 0, w: 0 });

  useEffect(() => { api.stats().then(setStats).catch(() => {}); api.listings({ sort: 'deadline', closing: 'week', limit: 8 }).then((r) => setSoon(r.listings)).catch(() => {}); }, []);
  // Record what people search for once they stop typing (not every keystroke)
  useEffect(() => {
    const q = f.q.trim();
    if (q.length < 2) return undefined;
    const t = setTimeout(() => track('search', { query: q }), 1500);
    return () => clearTimeout(t);
  }, [f.q]);
  useEffect(() => {
    if (!user) { setSavedIds(new Set()); return; }
    api.saved().then((r) => setSavedIds(new Set(r.saved.map((s) => s.listing.id)))).catch(() => {});
  }, [user]);
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true); setError('');
      const p = { limit, sort: f.sort };
      if (f.q) p.q = f.q; if (f.type) p.type = f.type; if (f.mode) p.mode = f.mode; if (f.platform) p.platform = f.platform;
      if (f.free) p.free = 'true'; if (f.closing) p.closing = f.closing;
      api.listings(p).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [f, limit, retry]);

  // slide the category indicator under the active button
  useLayoutEffect(() => {
    const el = rail.current?.querySelector('[aria-pressed="true"]');
    if (el) setThumb({ x: el.offsetLeft, w: el.offsetWidth });
  }, [f.type, stats]);

  const set = (k, v) => { setF((o) => ({ ...o, [k]: v })); setLimit(24); };
  const filtered = !!(f.q || f.type || f.platform || f.mode || f.free || f.closing || f.sort !== 'deadline');
  const key = JSON.stringify(f);

  return (
    <div className="bw">
      <section className="bw-hero">
        <div>
          <p className="bw-kicker"><span /> Opportunity discovery</p>
          <h1>Find what moves you.</h1>
          <p className="bw-sub"><CountUp value={stats?.open} /> open opportunities across <CountUp value={stats?.platforms?.length} /> platforms. Direct links to the organisers.</p>
        </div>
        <Link to="/ask" className="btn bw-ask">✦ Ask in plain English</Link>
      </section>

      <div className="bw-search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
        <input type="search" placeholder="Search title, organiser, theme…" value={f.q} onChange={(e) => set('q', e.target.value)} aria-label="Search" />
        <select value={f.sort} onChange={(e) => set('sort', e.target.value)} aria-label="Sort">
          <option value="deadline">Soonest deadline</option><option value="prize">Biggest prize</option><option value="popular">Most registered</option>
        </select>
      </div>

      <div className="bw-rail-wrap">
        <div className="bw-rail" ref={rail} role="group" aria-label="Filter opportunities by type">
          <i className="bw-thumb" style={{ transform: `translateX(${thumb.x}px)`, width: thumb.w }} aria-hidden="true" />
          {CATS.map(([v, l, g]) => <button key={v || 'all'} type="button" aria-pressed={f.type === v} onClick={() => set('type', v)}><span aria-hidden="true">{g}</span>{l}</button>)}
        </div>
      </div>

      {!filtered && soon.length > 0 && (
        <section className="bw-soon-wrap" aria-label="Closing this week">
          <h2><span className="bw-clock" aria-hidden="true">◷</span> Closing this week</h2>
          <div className="bw-soon-row">{soon.map((l) => <CloseCard key={l.id} item={l} />)}</div>
        </section>
      )}

      <div className="bw-bar">
        <div className="bw-modes" role="group" aria-label="Mode">{MODES.map(([v, l]) => <button key={v || 'any'} aria-pressed={f.mode === v} className={f.mode === v ? 'on' : ''} onClick={() => set('mode', v)}>{l}</button>)}</div>
        <select value={f.platform} onChange={(e) => set('platform', e.target.value)} aria-label="Platform">
          <option value="">All platforms</option>{stats?.platforms.map((p) => <option key={p.name} value={p.name}>{p.name} ({p.count})</option>)}
        </select>
        <label className="switch"><input type="checkbox" checked={f.free} onChange={(e) => set('free', e.target.checked)} /><i />Free entry</label>
        <label className="switch"><input type="checkbox" checked={f.closing === 'week'} onChange={(e) => set('closing', e.target.checked ? 'week' : '')} /><i />Closing this week</label>
        <span className="bw-spacer" />
        <div className="bw-view" role="group" aria-label="Layout"><button aria-pressed={!list} className={!list ? 'on' : ''} onClick={() => setList(false)} aria-label="Grid view">▦</button><button aria-pressed={list} className={list ? 'on' : ''} onClick={() => setList(true)} aria-label="List view">☰</button></div>
      </div>

      {error && <div className="bw-empty"><p className="error">Couldn’t load listings: {error}</p><button className="btn" onClick={() => setRetry((n) => n + 1)}>Try again</button></div>}
      <div className="bw-meta"><p aria-live="polite">{loading ? 'Scanning…' : <><b>{data.total}</b> opportunit{data.total === 1 ? 'y' : 'ies'}</>}</p>{filtered && <button className="link small" onClick={() => setF({ ...EMPTY })}>Clear all filters</button>}</div>

      {loading && !data.listings.length ? <Scanning /> : (
        <div className={`bw-grid ${list ? 'list' : ''}`} key={key}>
          {data.listings.map((l, i) => <DiscoveryCard key={l.id} item={l} saved={savedIds.has(l.id)} i={i} list={list} />)}
        </div>
      )}
      {!loading && !error && !data.listings.length && <Radar filtered={filtered} onClear={() => setF({ ...EMPTY })} />}
      {data.listings.length < data.total && <button className="btn ghost bw-more" onClick={() => setLimit(limit + 24)}>Show more opportunities</button>}
    </div>
  );
}

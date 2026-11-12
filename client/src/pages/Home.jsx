import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ListingCard, Empty, SkeletonGrid, closes, prizeText } from '../components.jsx';

const TYPES = ['', 'HACKATHON', 'CODING', 'COMPETITION', 'CASE STUDY', 'QUIZ', 'DESIGN', 'INNOVATION', 'CONTEST'];
const QUICK_TYPES = [
  { label: 'All opportunities', value: '' },
  { label: 'Hackathons', value: 'HACKATHON' },
  { label: 'Coding', value: 'CODING' },
  { label: 'Design', value: 'DESIGN' },
  { label: 'Case studies', value: 'CASE STUDY' },
];

const Arrow = () => <svg aria-hidden="true" viewBox="0 0 20 20" className="landing-arrow"><path d="M4 10h11M10 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const Spark = () => <svg aria-hidden="true" viewBox="0 0 24 24" className="landing-spark"><path d="m12 2 1.9 7.1L21 11l-7.1 1.9L12 20l-1.9-7.1L3 11l7.1-1.9L12 2Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="m19 15 .9 3.1L23 19l-3.1.9L19 23l-.9-3.1L15 19l3.1-.9L19 15Z" fill="currentColor" /></svg>;

export default function Home() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [f, setF] = useState({ q: '', type: '', platform: '', mode: '', free: false, closing: '', sort: 'deadline' });
  const [data, setData] = useState({ listings: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState(new Set());
  const [limit, setLimit] = useState(24);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const spotlight = data.listings[0];

  useEffect(() => { api.stats().then(setStats).catch(() => {}); }, []);
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

  const set = (k, v) => { setF((o) => ({ ...o, [k]: v })); setLimit(24); };
  const explore = () => document.getElementById('opportunities')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  const chooseType = (value) => { set('type', value); explore(); };
  const spotlightPrize = spotlight ? prizeText(spotlight.prize) : null;
  const spotlightDeadline = spotlight ? closes(spotlight.deadline) : null;

  return (
    <div className="home-page">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-copy">
          <p className="landing-kicker"><span className="pulse-dot" /> THE OPPORTUNITY HUB FOR BUILDERS</p>
          <h1 id="landing-title">Your next big idea deserves a <span>big stage.</span></h1>
          <p className="landing-lede">Find hackathons, competitions, and challenges in one place. Get matched to the ones that fit you, then keep every deadline in reach.</p>

          <form className="landing-search" role="search" onSubmit={(e) => { e.preventDefault(); explore(); }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
            <label className="visually-hidden" htmlFor="landing-search">Search opportunities</label>
            <input id="landing-search" type="search" placeholder="Try AI, climate, design…" value={f.q} onChange={(e) => set('q', e.target.value)} />
            <button className="btn primary" type="submit">Explore <Arrow /></button>
          </form>

          <div className="landing-quick" aria-label="Quick opportunity filters">
            <span className="landing-quick-label">Popular:</span>
            {QUICK_TYPES.slice(1).map((t) => <button key={t.value} type="button" className={`landing-chip ${f.type === t.value ? 'selected' : ''}`} aria-pressed={f.type === t.value} onClick={() => chooseType(t.value)}>{t.label}</button>)}
          </div>

          <div className="landing-actions">
            <Link className="landing-text-link" to="/for-you">{user ? 'See your personal matches' : 'Get matches for your profile'} <Arrow /></Link>
            <a className="landing-secondary-link" href="#how-it-works">See how it works <span aria-hidden="true">↓</span></a>
          </div>

          <div className="landing-proof" aria-label="Live opportunity statistics">
            <div><strong>{stats ? stats.open.toLocaleString('en-IN') : '—'}</strong><span>open opportunities</span></div>
            <i aria-hidden="true" />
            <div><strong>{stats ? stats.platforms.length : '—'}</strong><span>platforms, one feed</span></div>
            <i aria-hidden="true" />
            <div><strong>{stats ? stats.closingWeek : '—'}</strong><span>closing this week</span></div>
          </div>
        </div>

        <div className="landing-visual" aria-label="Opportunity preview">
          <div className="landing-orbit orbit-one" />
          <div className="landing-orbit orbit-two" />
          <div className="landing-glow" />
          <div className="float-tag float-tag-top"><span className="float-icon"><Spark /></span><span><b>Made for your next move</b><small>Discover · Match · Build</small></span></div>
          {spotlight ? (
            <Link to={`/listing/${spotlight.id}`} className="spotlight-card" aria-label={`View ${spotlight.title}`}>
              <div className="spotlight-top"><span className="spotlight-label"><span className="pulse-dot" /> LIVE OPPORTUNITY</span><span className="spotlight-index">SPOTLIGHT</span></div>
              <div className="spotlight-art"><div className="spotlight-sun" /><div className="spotlight-horizon" /><span className="spotlight-star star-a">✦</span><span className="spotlight-star star-b">✧</span><span className="spotlight-star star-c">✦</span><span className="spotlight-monogram">{(spotlight.type || 'H').slice(0, 1)}</span></div>
              <div className="spotlight-body">
                <p className="spotlight-overline">{spotlight.type?.toLowerCase() || 'opportunity'} <span>·</span> {spotlight.mode?.toLowerCase() || 'online'}</p>
                <h2>{spotlight.title}</h2>
                <p className="spotlight-organiser">{spotlight.organiser || 'Open to builders everywhere'} <span>·</span> {spotlight.platform}</p>
                <div className="spotlight-footer"><span className={`spotlight-deadline ${spotlightDeadline?.tone || ''}`}>◷ {spotlightDeadline?.text || 'Open now'}</span>{spotlightPrize ? <span className="spotlight-prize">{spotlightPrize.text}</span> : <span className="spotlight-prize">Explore details <Arrow /></span>}</div>
              </div>
              <div className="spotlight-open" aria-hidden="true"><Arrow /></div>
            </Link>
          ) : (
            <div className="spotlight-card spotlight-empty"><div className="spotlight-top"><span className="spotlight-label"><span className="pulse-dot" /> YOUR NEXT MOVE</span><span className="spotlight-index">EXPLORE</span></div><div className="spotlight-art"><div className="spotlight-sun" /><div className="spotlight-horizon" /><span className="spotlight-monogram">H</span></div><div className="spotlight-body"><p className="spotlight-overline">A world of ideas starts here</p><h2>{loading ? 'Finding your next challenge…' : 'Your next stage is waiting.'}</h2><p className="spotlight-organiser">Fresh opportunities, gathered from across the web.</p><div className="spotlight-footer"><span className="spotlight-deadline">Discover something new</span></div></div></div>
          )}
          <div className="float-tag float-tag-bottom"><span className="float-check">✓</span><span><b>Deadlines, handled.</b><small>Keep the momentum going</small></span></div>
          <span className="landing-visual-caption">A better way to find what’s next.</span>
        </div>
      </section>

      <section className="landing-steps" id="how-it-works" aria-labelledby="steps-title">
        <div className="landing-section-heading"><p className="landing-kicker">FROM IDEA TO ACTION</p><h2 id="steps-title">Make opportunity work for you.</h2><p>Less searching in circles. More time building something that matters.</p></div>
        <div className="journey-grid">
          <a href="#opportunities" className="journey-card">
            <span className="journey-number">01</span><span className="journey-icon discover-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5M8 11l2-2 1.5 2 2.5-3" /></svg></span>
            <h3>Find your next challenge</h3><p>Browse a fresh feed of hackathons, contests, and competitions from across platforms.</p><span className="journey-link">Explore the feed <Arrow /></span>
          </a>
          <Link to="/for-you" className="journey-card">
            <span className="journey-number">02</span><span className="journey-icon match-icon"><Spark /></span>
            <h3>See what fits you</h3><p>Get thoughtful picks based on your skills, interests, location, and resume.</p><span className="journey-link">Get matched <Arrow /></span>
          </Link>
          <Link to="/tracker" className="journey-card">
            <span className="journey-number">03</span><span className="journey-icon track-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 3v4M16 3v4M4 10h16m-11 5 2 2 4-4" /></svg></span>
            <h3>Keep your momentum</h3><p>Save opportunities, track your applications, and stay ahead of each deadline.</p><span className="journey-link">Open your tracker <Arrow /></span>
          </Link>
        </div>
      </section>

      <section className="opportunities-section" id="opportunities" aria-labelledby="opportunities-title">
        <div className="opportunity-heading">
          <div><p className="landing-kicker"><span className="pulse-dot" /> THE LIVE FEED</p><h2 id="opportunities-title">Find the one that moves you.</h2><p className="muted">Real opportunities. Direct links to the organisers. Your next step starts here.</p></div>
          <Link to="/ask" className="btn ghost opportunity-ask">Have a question? Ask AI <Arrow /></Link>
        </div>

        <div className="landing-categories" role="group" aria-label="Filter opportunities by type">
          {QUICK_TYPES.map((t) => <button key={t.value || 'all'} type="button" className={`landing-chip ${f.type === t.value ? 'selected' : ''}`} aria-pressed={f.type === t.value} onClick={() => set('type', t.value)}>{t.label}</button>)}
        </div>

        <section aria-label="More opportunity filters" className="filters">
          <input type="search" placeholder="Search title, organiser, theme…" value={f.q} onChange={(e) => set('q', e.target.value)} aria-label="Search" />
          <select value={f.type} onChange={(e) => set('type', e.target.value)} aria-label="Type">
            {TYPES.map((t) => <option key={t} value={t}>{t ? t.toLowerCase() : 'all types'}</option>)}
          </select>
          <select value={f.platform} onChange={(e) => set('platform', e.target.value)} aria-label="Platform">
            <option value="">all platforms</option>
            {stats?.platforms.map((p) => <option key={p.name} value={p.name}>{p.name} ({p.count})</option>)}
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

        {error && <div className="empty"><p className="error">Couldn’t load listings: {error}</p><button className="btn" onClick={() => setRetry((n) => n + 1)}>Try again</button></div>}
        <div className="results-meta"><p className="muted small" aria-live="polite">{loading ? 'Finding opportunities…' : `${data.total} opportunity${data.total === 1 ? '' : 'ies'}`}</p>{(f.q || f.type || f.platform || f.mode || f.free || f.closing || f.sort !== 'deadline') && <button className="link small" onClick={() => { setF({ q: '', type: '', platform: '', mode: '', free: false, closing: '', sort: 'deadline' }); setLimit(24); }}>Clear filters</button>}</div>
        {loading && !data.listings.length && <SkeletonGrid />}
        <div className="grid">
          {data.listings.map((l) => <ListingCard key={l.id} item={l} saved={savedIds.has(l.id)} />)}
        </div>
        {!loading && !error && !data.listings.length && <Empty>Nothing matches those filters. Try another category or clear a filter.</Empty>}
        {data.listings.length < data.total && <button className="btn ghost center" onClick={() => setLimit(limit + 24)}>Show more opportunities <Arrow /></button>}
      </section>
    </div>
  );
}

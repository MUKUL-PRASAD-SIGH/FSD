import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Breakdown, KIND, closes, prizeText, useListingActions } from '../components.jsx';
import ResumeStudio from '../ResumeStudio.jsx';
import { CountUp, Reveal, Ring } from '../ui.jsx';
import './foryou.css';

// The 3 strongest scoring criteria become inline "skill-match" bars. Pro results carry `criteria`; basic ones a `breakdown` map.
function topCriteria(rec) {
  const rows = rec.criteria || Object.entries(rec.breakdown || {}).map(([key, v]) => ({ key, label: key, score: v }));
  return [...rows].sort((a, b) => b.score - a.score).slice(0, 3);
}

function MatchCard({ rec, rank, i }) {
  const item = rec.listing;
  const { isSaved, busy, toggleSave, registered } = useListingActions(item, false, undefined, '/for-you');
  const [why, setWhy] = useState(false);
  const c = closes(item.deadline);
  const prize = prizeText(item.prize);
  const kind = KIND[item.deadlineKind] || 'closes';
  const bars = topCriteria(rec);
  const gaps = rec.missingSkills?.slice(0, 3) || [];
  return (
    <article className="fy-card" style={{ '--i': Math.min(i, 10) }}>
      <span className="fy-rank" aria-label={`Rank ${rank}`}>{String(rank).padStart(2, '0')}</span>
      <Ring value={rec.score} size={78} stroke={7} label={rec.score} sub="match" />
      <div className="fy-main">
        <div className="fy-top"><span className={`fy-due ${c.tone}`}>{c.tone ? c.text : `${kind === 'starts' ? 'starts' : 'closes'} ${c.text}`}</span><span className="fy-type">{item.type.toLowerCase()} · {item.mode.toLowerCase()}{item.city ? ` · ${item.city}` : ''}</span>{prize && <span className="fy-prize">{prize.text}</span>}</div>
        <h3><Link to={`/listing/${item.id}`}>{item.title}</Link></h3>
        <p className="fy-org">{item.organiser || 'Organiser'} · {item.platform}</p>
        {rec.reasons?.length > 0 && <ul className="fy-why">{rec.reasons.slice(0, 3).map((r) => <li key={r}>{r}</li>)}</ul>}
        <div className="fy-bars" aria-label="Strongest match criteria">
          {bars.map((b) => <div key={b.key}><span>{b.label}</span><i style={{ '--w': `${Math.round(b.score * 100)}%` }} /><b>{Math.round(b.score * 100)}</b></div>)}
        </div>
        {gaps.length > 0 && <p className="fy-gaps"><span>to stand out, add</span>{gaps.map((g) => <em key={g}>+ {g}</em>)}</p>}
        {rec.eligibility?.eligible === null && /check/.test(rec.eligibility.note || '') && <p className="fy-note">{rec.eligibility.note}</p>}
        {why && <Breakdown rec={rec} />}
        <div className="fy-actions">
          <button className="btn ghost" onClick={toggleSave} disabled={busy} aria-pressed={isSaved}>{isSaved ? '★ Saved' : '☆ Save'}</button>
          <button className="btn ghost" onClick={() => setWhy(!why)} aria-expanded={why}>{why ? 'Hide breakdown' : 'Why this score?'}</button>
          <a className="btn primary" href={item.url} target="_blank" rel="noreferrer noopener" onClick={registered}>Register ↗</a>
        </div>
      </div>
    </article>
  );
}

function Signal({ data, recs }) {
  const buckets = useMemo(() => {
    const b = [['Strong', 70, 101], ['Good', 45, 70], ['Stretch', 0, 45]].map(([l, lo, hi]) => ({ l, n: recs.filter((r) => r.score >= lo && r.score < hi).length }));
    const max = Math.max(1, ...b.map((x) => x.n)); return b.map((x) => ({ ...x, w: (x.n / max) * 100 }));
  }, [recs]);
  const gaps = useMemo(() => {
    const m = new Map(); recs.forEach((r) => (r.missingSkills || []).forEach((s) => m.set(s, (m.get(s) || 0) + 1)));
    const arr = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5); const max = Math.max(1, ...arr.map((x) => x[1]));
    return arr.map(([s, n]) => ({ s, n, w: (n / max) * 100 }));
  }, [recs]);
  const b = data.basedOn;
  return (
    <aside className="fy-side" aria-label="Your signal">
      <section className="fy-panel">
        <h2>Your signal</h2>
        <p className="fy-src"><span className="on">{b.resume ? 'Resume parsed' : 'Profile only'}</span>{b.location && <span>near {b.location}</span>}</p>
        {b.skills.length > 0 && <p className="fy-skills">{b.skills.slice(0, 12).map((s) => <span key={s}>{s}</span>)}</p>}
        <Link to="/profile" className="fy-edit">Edit profile →</Link>
      </section>
      <section className="fy-panel">
        <h2>Match distribution</h2>
        <div className="fy-dist">{buckets.map((x) => <div key={x.l}><span>{x.l}</span><i><u style={{ '--w': `${x.w}%` }} /></i><b>{x.n}</b></div>)}</div>
      </section>
      <section className="fy-panel">
        <h2>Skills to add</h2>
        {gaps.length ? <div className="fy-dist gaps">{gaps.map((g) => <div key={g.s}><span>{g.s}</span><i><u style={{ '--w': `${g.w}%` }} /></i><b>{g.n}</b></div>)}</div> : <p className="muted small">No obvious gaps right now.</p>}
        <p className="muted small">Number of picks each skill would strengthen.</p>
      </section>
    </aside>
  );
}

function Skeleton() {
  return (
    <div className="fy">
      <div className="fy-hero"><h1>For you</h1></div>
      <p className="muted" aria-live="polite">Ranking open listings against your profile…</p>
      <div className="fy-tiles">{Array.from({ length: 4 }, (_, k) => <div key={k} className="fy-tile fy-skel" />)}</div>
      {Array.from({ length: 3 }, (_, k) => <div key={k} className="fy-card fy-skel" style={{ minHeight: 150 }} />)}
    </div>
  );
}

export default function ForYou() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = () => { setError(''); api.recommendations().then(setData).catch((e) => setError(e.message)); };
  useEffect(load, []);

  if (error) return <div className="empty"><p className="error">{error}</p><button className="btn" onClick={load}>Try again</button></div>;
  if (!data) return <Skeleton />;
  const recs = data.recommendations || [];
  const ex = data.excluded || {};
  const hiddenN = (ex.ineligible || 0) + (ex.duplicate || 0) + (ex.saved || 0);
  const hidden = [ex.ineligible && `${ex.ineligible} you’re not eligible for`, ex.duplicate && `${ex.duplicate} duplicate${ex.duplicate === 1 ? '' : 's'}`, ex.saved && `${ex.saved} already in your tracker`].filter(Boolean);
  const pro = data.tier === 'pro';
  const strong = recs.filter((r) => r.score >= 70).length;
  const best = recs[0]?.score ?? 0;

  return (
    <div className="fy">
      <div className="fy-hero">
        <div><p className="fy-kicker">Personalised intelligence</p><h1>For you</h1></div>
        <span className={`fy-tier ${pro ? 'pro' : ''}`}>{pro ? '✦ Personalised ranking' : 'Basic picks'}</span>
      </div>

      {data.hasSignal && (
        <div className="fy-tiles">
          <Reveal className="fy-tile hero"><Ring value={best} size={92} stroke={9} label={best} sub="best" /><div><b>Top match</b><span>{recs[0]?.listing.title || '—'}</span></div></Reveal>
          <Reveal className="fy-tile" delay={70}><strong><CountUp value={strong} /></strong><span>strong matches <small>(70+)</small></span></Reveal>
          <Reveal className="fy-tile" delay={140}><strong><CountUp value={recs.length} /></strong><span>ranked for you</span></Reveal>
          <Reveal className="fy-tile" delay={210}><strong><CountUp value={hiddenN} /></strong><span>hidden by filters</span></Reveal>
        </div>
      )}

      <details className="fy-studio" open={!data.hasSignal}>
        <summary>Resume and profile signal</summary>
        <ResumeStudio onChange={load} />
      </details>

      {!data.hasSignal ? (
        <div className="fy-empty">
          <div className="fy-empty-art" aria-hidden="true"><i /><i /><i /></div>
          <h2>We don’t know enough about you yet</h2>
          <p>Add skills and interests{pro ? ' or upload your resume' : ''} and this page fills in with ranked picks and the reasons behind each one.</p>
          <Link className="btn primary" to="/profile">Build my profile</Link>
        </div>
      ) : (
        <>
          {hidden.length > 0 && <p className="fy-hidden">Hidden: {hidden.join(' · ')}.{!data.basedOn.education && ' Add your education level in your profile so we can filter by eligibility.'}</p>}
          <div className="fy-layout">
            <section className="fy-list" aria-label="Ranked recommendations">
              {recs.map((r, i) => <MatchCard key={r.listing.id} rec={r} rank={i + 1} i={i} />)}
              {!recs.length && <div className="fy-empty"><h2>All caught up</h2><p>No open listings left to recommend. Check back after the next refresh.</p></div>}
            </section>
            <Signal data={data} recs={recs} />
          </div>
        </>
      )}
    </div>
  );
}

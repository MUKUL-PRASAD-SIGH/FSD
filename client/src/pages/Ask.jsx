import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { KIND, closes, prizeText, useListingActions } from '../components.jsx';
import { reducedMotion } from '../ui.jsx';
import './ask.css';

const EXAMPLES = ['Case competitions for engineering students', 'Online AI hackathons closing soon', 'Free contests with 1L+ prizes', 'In person web hackathons'];
const HINTS = ['online ML hackathons closing soon with 1L+ prize', 'case competitions for first-year students', 'free design contests this month'];

// Rotating typed placeholder for the empty state (static when motion is reduced).
function useTypedHint(active) {
  const [text, setText] = useState(HINTS[0]);
  useEffect(() => {
    if (!active || reducedMotion()) return undefined;
    let h = 0; let c = 0; let del = false; let t;
    const tick = () => {
      const full = HINTS[h];
      c += del ? -1 : 1; setText(full.slice(0, c));
      if (!del && c === full.length) { del = true; t = setTimeout(tick, 1600); return; }
      if (del && c === 0) { del = false; h = (h + 1) % HINTS.length; }
      t = setTimeout(tick, del ? 22 : 48);
    };
    t = setTimeout(tick, 600);
    return () => clearTimeout(t);
  }, [active]);
  return text;
}

function ResultRow({ rec, rank, i }) {
  const item = rec.listing;
  const { isSaved, busy, toggleSave, registered } = useListingActions(item, false, undefined, '/ask');
  const c = closes(item.deadline);
  const prize = prizeText(item.prize);
  const kind = KIND[item.deadlineKind] || 'closes';
  return (
    <li className="ak-row" style={{ '--i': i }}>
      <span className="ak-rank">{rank}</span>
      <div className="ak-row-main">
        <Link to={`/listing/${item.id}`} className="ak-title">{item.title}</Link>
        <p className="ak-meta">{item.type.toLowerCase()} · {item.mode.toLowerCase()}{item.city ? ` · ${item.city}` : ''} · <span className={c.tone}>{c.tone ? c.text : `${kind === 'starts' ? 'starts' : 'closes'} ${c.text}`}</span>{prize ? <> · <b>{prize.text}</b></> : null} · {item.platform}</p>
        {rec.reasons?.[0] && <p className="ak-why">{rec.reasons[0]}</p>}
      </div>
      <span className="ak-score" title="Match score out of 100"><i style={{ '--w': `${rec.score}%` }} /><b>{rec.score}</b></span>
      <div className="ak-row-actions">
        <button className="ak-icon" onClick={toggleSave} disabled={busy} aria-pressed={isSaved} aria-label={isSaved ? `Unsave ${item.title}` : `Save ${item.title}`}>{isSaved ? '★' : '☆'}</button>
        <a className="btn primary" href={item.url} target="_blank" rel="noreferrer noopener" onClick={registered}>Register ↗</a>
      </div>
    </li>
  );
}

function Answer({ turn }) {
  const [all, setAll] = useState(false);
  if (turn.busy) return <div className="ak-msg sys" role="status"><span className="ak-read"><i /><i /><i /></span><span className="ak-reading">Reading your sentence and ranking matches…</span></div>;
  if (turn.error) return <div className="ak-msg sys err" role="alert">{turn.error}</div>;
  const res = turn.res;
  const shown = all ? res.results : res.results.slice(0, 5);
  return (
    <div className="ak-msg sys">
      <p className="ak-understood">
        {res.understood.length
          ? <>I understood: {res.understood.map((u, n) => <span key={u} className="ak-tok" style={{ '--n': n }}>{u}</span>)}</>
          : 'No specific filters recognised, so I ranked by relevance.'}
      </p>
      <p className="ak-count"><b>{res.total}</b> open listing{res.total === 1 ? '' : 's'} matched{res.personalised === false && <> · <Link to="/login">sign in</Link> to factor in your resume</>}</p>
      {res.results.length ? (
        <>
          <ol className="ak-rows">{shown.map((r, n) => <ResultRow key={r.listing.id} rec={r} rank={n + 1} i={n} />)}</ol>
          {res.results.length > 5 && <button className="ak-more" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${res.results.length}`}</button>}
        </>
      ) : <p className="ak-none">{res.note || 'No open listings fit that. Try fewer constraints.'}</p>}
    </div>
  );
}

export default function Ask() {
  const [q, setQ] = useState('');
  const [turns, setTurns] = useState([]);
  const end = useRef(null);
  const busy = turns.some((t) => t.busy);
  const hint = useTypedHint(!turns.length && !q);

  async function go(question) {
    const text = question.trim();
    if (text.length < 3 || busy) return;
    const id = Date.now();
    setQ(''); setTurns((t) => [...t, { id, q: text, busy: true }]);
    try { const res = await api.ask(text); setTurns((t) => t.map((x) => (x.id === id ? { ...x, busy: false, res } : x))); }
    catch (e) { setTurns((t) => t.map((x) => (x.id === id ? { ...x, busy: false, error: e.message } : x))); }
    setTimeout(() => end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
  }

  const started = turns.length > 0;
  return (
    <div className={`ak ${started ? 'started' : ''}`}>
      {!started && (
        <header className="ak-hero">
          <p className="ak-kicker">Ask</p>
          <h1>Say it like you <em>mean</em> it.</h1>
          <p>Describe who you are and what you want. We read the filters out of your sentence and rank the matches.</p>
        </header>
      )}
      {started && (
        <div className="ak-thread" aria-live="polite">
          {turns.map((t) => (
            <div key={t.id} className="ak-turn">
              <div className="ak-msg me">{t.q}</div>
              <Answer turn={t} />
            </div>
          ))}
          <div ref={end} />
        </div>
      )}
      <form className="ak-composer" onSubmit={(e) => { e.preventDefault(); go(q); }}>
        <label className="visually-hidden" htmlFor="ak-in">Your question</label>
        <span className="ak-prompt" aria-hidden="true">›</span>
        <input id="ak-in" value={q} onChange={(e) => setQ(e.target.value)} maxLength={300} placeholder={started ? 'Ask a follow-up search…' : `e.g. ${hint}`} autoComplete="off" />
        <button className="btn primary" disabled={busy || q.trim().length < 3}>{busy ? 'Searching…' : 'Ask'}</button>
      </form>
      {!started && <div className="ak-chips" role="group" aria-label="Example questions">{EXAMPLES.map((x, n) => <button key={x} style={{ '--n': n }} onClick={() => go(x)}>{x}</button>)}</div>}
      {started && !busy && <div className="ak-chips small" role="group" aria-label="Try another">{EXAMPLES.map((x) => <button key={x} onClick={() => go(x)}>{x}</button>)}</div>}
    </div>
  );
}

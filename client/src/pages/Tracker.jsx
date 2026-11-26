import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { closes } from '../components.jsx';
import CalendarSync from '../CalendarSync.jsx';
import ShareModal from '../ShareModal.jsx';
import { CountUp, Icon, Reveal } from '../ui.jsx';
import './tracker.css';

const STAGES = ['saved', 'applied', 'shortlisted', 'won', 'rejected'];
const STAGE_NOTE = { saved: 'Interested', applied: 'Submitted', shortlisted: 'In the running', won: 'Success', rejected: 'Not this time' };
const daysLeft = (d) => Math.ceil((new Date(d) - Date.now()) / 86400000);

// Next 30 days as a track; each open deadline is a dot, staggered vertically so neighbours never overlap.
function Timeline({ rows }) {
  const items = rows.filter((r) => ['saved', 'applied', 'shortlisted'].includes(r.status)).map((r) => ({ r, d: daysLeft(r.listing.deadline) })).filter((x) => x.d >= 0 && x.d <= 30).sort((a, b) => a.d - b.d);
  return (
    <section className="tk-time" aria-label="Deadlines in the next 30 days">
      <div className="tk-time-h"><h2>Next 30 days</h2><span>{items.length} deadline{items.length === 1 ? '' : 's'}</span></div>
      <div className="tk-axis">
        {[0, 7, 14, 21, 30].map((t) => <span key={t} className="tk-tick" style={{ left: `${(t / 30) * 100}%` }}>{t === 0 ? 'today' : `+${t}d`}</span>)}
        <i className="tk-today" />
        {items.map(({ r, d }, n) => (
          <a key={r.id} href={r.listing.url} target="_blank" rel="noreferrer" className={`tk-dot ${d <= 3 ? 'hot' : d <= 7 ? 'warm' : ''} ${d > 16 ? 'flip' : ''}`} style={{ [d > 16 ? 'right' : 'left']: `${d > 16 ? 100 - (d / 30) * 100 : (d / 30) * 100}%`, '--row': n % 3, '--n': n }} aria-label={`${r.listing.title}, ${d === 0 ? 'closes today' : `${d} day${d === 1 ? '' : 's'} left`}`}>
            <b />
            <span>{r.listing.title}<small>{d === 0 ? 'today' : `${d}d`}</small></span>
          </a>
        ))}
        {!items.length && <p className="tk-quiet">Nothing closing in the next 30 days.</p>}
      </div>
    </section>
  );
}

function Card({ r, onMove, onRemove, onTeam, isPro, dragging, setDragging }) {
  const c = closes(r.listing.deadline);
  const d = daysLeft(r.listing.deadline);
  return (
    <div className={`tk-card ${dragging === r.id ? 'drag' : ''}`} draggable onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', r.id); setDragging(r.id); }} onDragEnd={() => setDragging(null)}>
      <a href={r.listing.url} target="_blank" rel="noreferrer" className="tk-title">{r.listing.title}</a>
      <p className="tk-tags">
        <span className={`tk-tag due ${d < 0 ? 'past' : c.tone}`}>{d < 0 ? 'closed' : c.text}</span>
        <span className="tk-tag">{r.listing.platform}</span>
        {r.listing.type && <span className="tk-tag cool">{r.listing.type.toLowerCase()}</span>}
      </p>
      <div className="tk-foot">
        <select value={r.status} onChange={(e) => onMove(r, e.target.value)} aria-label={`Move ${r.listing.title} to stage`}>{STAGES.map((x) => <option key={x}>{x}</option>)}</select>
        <button className="tk-act" onClick={() => onTeam(r.listing)} title="Team up on this event"><Icon name="people" />{!isPro && '✦'}<span> team up</span></button>
        <button className="tk-act danger" onClick={() => onRemove(r)} aria-label={`Remove ${r.listing.title}`} title="Remove">✕</button>
      </div>
    </div>
  );
}

export default function Tracker() {
  const { user, isPro } = useAuth();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [share, setShare] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [over, setOver] = useState('');

  useEffect(() => { if (user) api.saved().then((r) => setRows(r.saved)).catch((e) => setError(e.message)); }, [user]);

  const counts = useMemo(() => Object.fromEntries(STAGES.map((s) => [s, (rows || []).filter((r) => r.status === s).length])), [rows]);
  const next = useMemo(() => (rows || []).filter((r) => ['saved', 'applied', 'shortlisted'].includes(r.status) && daysLeft(r.listing.deadline) >= 0).sort((a, b) => new Date(a.listing.deadline) - new Date(b.listing.deadline))[0], [rows]);

  if (error) return <p className="error">{error}</p>;
  if (!rows) return <div className="tk"><h1>Tracker</h1><div className="tk-board">{STAGES.map((s) => <div key={s} className="tk-col tk-skel" />)}</div></div>;

  async function move(row, status) {
    if (row.status === status) return;
    setRows(rows.map((r) => (r.id === row.id ? { ...r, status } : r)));
    try { await api.saveListing(row.listing.id, { status }); } catch (e) { setError(e.message); }
  }
  async function remove(row) {
    setRows(rows.filter((r) => r.id !== row.id));
    try { await api.unsave(row.listing.id); } catch (e) { setError(e.message); }
  }
  const drop = (stage) => (e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain') || dragging; const row = rows.find((r) => r.id === id); setOver(''); setDragging(null); if (row) move(row, stage); };

  const total = rows.length;
  const active = counts.applied + counts.shortlisted;
  const nd = next ? daysLeft(next.listing.deadline) : null;

  return (
    <div className="tk">
      <header className="tk-head">
        <div><p className="tk-kicker">Application command centre</p><h1>Tracker</h1></div>
        <details className="tk-cal"><summary className="btn ghost">◷ Calendar sync</summary><div className="tk-cal-body"><CalendarSync /></div></details>
      </header>

      {total > 0 && (
        <>
          <div className="tk-tiles">
            <Reveal className="tk-tile"><b><CountUp value={total} /></b><span>tracked</span></Reveal>
            <Reveal className="tk-tile" delay={60}><b><CountUp value={active} /></b><span>in progress</span></Reveal>
            <Reveal className="tk-tile win" delay={120}><b><CountUp value={counts.won} /></b><span>won</span></Reveal>
            <Reveal className={`tk-tile next ${nd != null && nd <= 3 ? 'hot' : ''}`} delay={180}>
              {next ? <><b>{nd === 0 ? 'Today' : `${nd}d`}</b><span>until <em>{next.listing.title}</em></span></> : <><b>—</b><span>no open deadlines</span></>}
            </Reveal>
          </div>

          <section className="tk-funnel" aria-label="Pipeline by stage">
            <div className="tk-bar" role="img" aria-label={STAGES.map((s) => `${counts[s]} ${s}`).join(', ')}>
              {STAGES.map((s) => counts[s] > 0 && <i key={s} className={s} style={{ '--w': `${(counts[s] / total) * 100}%` }} title={`${counts[s]} ${s}`} />)}
            </div>
            <ul>{STAGES.map((s) => <li key={s}><i className={s} />{s} <b>{counts[s]}</b></li>)}</ul>
          </section>
          <Timeline rows={rows} />
        </>
      )}

      {!total ? (
        <div className="tk-empty">
          <div className="tk-empty-art" aria-hidden="true">{[0, 1, 2].map((k) => <i key={k} style={{ '--k': k }} />)}</div>
          <h2>Your pipeline is empty</h2>
          <p>Hit “Save” on any listing to start tracking it here. Drag cards between stages as you apply, get shortlisted and win.</p>
          <Link className="btn primary" to="/browse">Find opportunities</Link>
        </div>
      ) : (
        <div className="tk-board" role="list">
          {STAGES.map((s) => {
            const list = rows.filter((r) => r.status === s);
            return (
              <section key={s} role="listitem" className={`tk-col ${s} ${over === s ? 'over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(s); }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(''); }} onDrop={drop(s)} aria-label={`${s}, ${list.length}`}>
                <h2><i />{s}<span>{list.length}</span></h2>
                <p className="tk-note">{STAGE_NOTE[s]}</p>
                {list.map((r) => <Card key={`${r.id}-${r.status}`} r={r} onMove={move} onRemove={remove} onTeam={setShare} isPro={isPro} dragging={dragging} setDragging={setDragging} />)}
                {!list.length && <div className="tk-drop"><span aria-hidden="true">⤓</span>Drop a card here</div>}
              </section>
            );
          })}
        </div>
      )}
      {share && <ShareModal listing={share} onClose={() => setShare(null)} />}
    </div>
  );
}

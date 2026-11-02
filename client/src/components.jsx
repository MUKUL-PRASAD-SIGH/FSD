import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from './api.js';
import { useAuth } from './auth.jsx';

export const inr = (n) => {
  if (n == null) return null;
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(n % 1e7 ? 1 : 0)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(n % 1e5 ? 1 : 0)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
};

export function closes(deadline) {
  const days = Math.ceil((new Date(deadline) - Date.now()) / 86400000);
  if (days <= 0) return { text: 'closes today', tone: 'hot' };
  if (days <= 3) return { text: `${days}d left`, tone: 'hot' };
  if (days <= 7) return { text: `${days}d left`, tone: 'warm' };
  return { text: new Date(deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), tone: '' };
}

const KIND = { registration: 'registration closes', submission: 'submissions close', event_start: 'starts', event_end: 'ends' };

// Original currency first (what the organiser published); rupee conversion as a hint
export function prizeText(p) {
  if (!p) return null;
  if (p.currency && p.currency !== 'INR' && p.label && p.inr) return { text: p.label, title: `≈ ${inr(p.inr)}` };
  if (p.inr) return { text: inr(p.inr), title: '' };
  return p.label && p.label !== 'See listing' ? { text: p.label, title: '' } : null;
}

function Breakdown({ rec }) {
  const rows = rec.criteria || Object.entries(rec.breakdown).map(([key, v]) => ({ key, label: key, score: v, points: null, weight: null, detail: '' }));
  return (
    <div className="bars" aria-label="Score breakdown">
      {rows.map((c) => (
        <div key={c.key} className="bar" title={c.detail || ''}>
          <span>{c.label}</span>
          <i style={{ '--w': `${Math.round(c.score * 100)}%` }} />
          <b>{c.points != null ? `+${Math.round(c.points)}` : Math.round(c.score * 100)}</b>
          {c.detail && <em>{c.detail}</em>}
        </div>
      ))}
      {rec.criteria && <p className="small muted">Points = weight × criterion score. Penalties for in-person events you can’t reach, unclear eligibility or paid entry can lower the total.</p>}
    </div>
  );
}

export function ListingCard({ item, rec, saved, onSaveChange }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [isSaved, setIsSaved] = useState(!!saved);
  const [open, setOpen] = useState(false);
  const c = closes(item.deadline);
  const prize = prizeText(item.prize);
  const kind = KIND[item.deadlineKind] || 'closes';
  const tone = rec ? (rec.score >= 70 ? 'hi' : rec.score >= 45 ? 'mid' : 'lo') : '';

  async function toggleSave() {
    if (!user) return nav('/login', { state: { from: '/' } });
    setBusy(true);
    try {
      if (isSaved) await api.unsave(item.id); else await api.saveListing(item.id);
      setIsSaved(!isSaved); onSaveChange?.(item.id, !isSaved);
    } finally { setBusy(false); }
  }

  return (
    <article className="card">
      <div className="card-top">
        <span className={`pill ${c.tone}`} title={`${kind} ${new Date(item.deadline).toLocaleString('en-IN')}`}>{c.tone ? c.text : `${kind === 'starts' ? 'starts' : 'closes'} ${c.text}`}</span>
        <span className="muted mono">{item.type.toLowerCase()}</span>
        {item.source === 'manual' && <span className="pill">verified lister</span>}
        {rec && <span className={`score ${tone}`} title="Match score out of 100">{rec.score}<small>/100</small></span>}
      </div>
      <h3><Link to={`/listing/${item.id}`}>{item.title}</Link></h3>
      <p className="muted small">{item.organiser || 'Organiser'} · {item.platform}{item.alsoOn?.length ? <> · also on {item.alsoOn.map((a) => a.platform).join(', ')}</> : null}</p>
      <div className="meta mono">
        <span>{item.mode.toLowerCase()}{item.city ? ` · ${item.city}` : ''}</span>
        {prize && <span title={prize.title}>{prize.text}</span>}
        <span>{/free/i.test(item.fee) ? 'free entry' : item.fee}</span>
        {item.teamMax ? <span>team {item.teamMin || 1}–{item.teamMax}</span> : null}
      </div>
      {rec && (
        <>
          <ul className="why">
            {rec.reasons.map((r) => <li key={r}>{r}</li>)}
            {rec.eligibility?.eligible === null && /check/.test(rec.eligibility.note || '') && !rec.reasons.includes(rec.eligibility.note) && <li className="gap">{rec.eligibility.note}</li>}
            {rec.missingSkills?.length > 0 && <li className="gap">to stand out, add: {rec.missingSkills.slice(0, 3).join(', ')}</li>}
          </ul>
          <button className="link small" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Hide' : 'Why this score?'}</button>
          {open && <Breakdown rec={rec} />}
        </>
      )}
      <div className="card-actions">
        <button className="btn ghost" onClick={toggleSave} disabled={busy} aria-pressed={isSaved}>{isSaved ? '★ Saved' : '☆ Save'}</button>
        <a className="btn" href={item.url} target="_blank" rel="noreferrer noopener">Register ↗</a>
      </div>
    </article>
  );
}

export function SkeletonGrid({ n = 6 }) {
  return <div className="grid" aria-hidden="true">{Array.from({ length: n }, (_, i) => <div key={i} className="card skeleton"><i /><i /><i /><i /></div>)}</div>;
}

export function Empty({ children }) { return <div className="empty">{children}</div>; }

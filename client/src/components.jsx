import { useState } from 'react';
import { api } from './api.js';
import { useAuth } from './auth.jsx';

export const inr = (n) => {
  if (n == null) return null;
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)} Cr`;
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

export function ListingCard({ item, rec, saved, onSaveChange }) {
  const { user, openAuth } = useAuth();
  const [busy, setBusy] = useState(false);
  const [isSaved, setIsSaved] = useState(!!saved);
  const c = closes(item.deadline);
  const prize = item.prize?.inr ? inr(item.prize.inr) : item.prize?.label;

  async function toggleSave() {
    if (!user) return openAuth();
    setBusy(true);
    try {
      if (isSaved) await api.unsave(item.id);
      else await api.saveListing(item.id);
      setIsSaved(!isSaved);
      onSaveChange?.(item.id, !isSaved);
    } finally { setBusy(false); }
  }

  return (
    <article className="card">
      <div className="card-top">
        <span className={`pill ${c.tone}`}>{c.text}</span>
        <span className="muted mono">{item.type.toLowerCase()}</span>
        {rec && <span className="score" title="Match score">{rec.score}% match</span>}
      </div>
      <h3>{item.title}</h3>
      <p className="muted small">{item.organiser || 'Organiser'} · {item.platform}</p>
      <div className="meta mono">
        <span>{item.mode.toLowerCase()}{item.city ? ` · ${item.city}` : ''}</span>
        {prize && <span>{prize}</span>}
        <span>{/free/i.test(item.fee) ? 'free entry' : item.fee}</span>
      </div>
      {rec && (
        <ul className="why">
          {rec.reasons.map((r) => <li key={r}>{r}</li>)}
          {rec.missingSkills?.length > 0 && <li className="gap">to stand out, add: {rec.missingSkills.slice(0, 3).join(', ')}</li>}
        </ul>
      )}
      <div className="card-actions">
        <button className="btn ghost" onClick={toggleSave} disabled={busy}>{isSaved ? '★ Saved' : '☆ Save'}</button>
        <a className="btn" href={item.url} target="_blank" rel="noreferrer">Open ↗</a>
      </div>
    </article>
  );
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

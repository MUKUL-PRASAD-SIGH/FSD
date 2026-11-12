import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from './api.js';
import { useAuth } from './auth.jsx';
import { useToast } from './toast.jsx';

// Tracker -> "Team up on this hackathon". Pick someone you're connected with, or type the email of a registered person.
// If you don't have a team for this hackathon yet, one is created (with its private room). The person is invited, not added:
// they accept, then the hackathon appears in their tracker and they land in the team room.
export default function ShareModal({ listing, onClose }) {
  const toast = useToast();
  const { isPro } = useAuth();
  const [conns, setConns] = useState([]);
  const [pick, setPick] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(`Want to team up for ${listing.title}?`);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => { api.overview().then((o) => setConns(o.connections)).catch(() => {}); }, []);
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, [onClose]);

  async function send(e) {
    e.preventDefault(); setBusy(true);
    try {
      const r = await api.shareListing({ listingId: listing.id, userId: pick || undefined, email: pick ? undefined : email, message });
      setDone(r); toast(r.message, 'good');
    } catch (err) { toast(err.message, 'err'); } finally { setBusy(false); }
  }

  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-label="Team up" onClick={(e) => e.stopPropagation()} style={{ width: 'min(480px,100%)' }}>
        <h2>Team up on this hackathon</h2>
        <p className="muted small">{listing.title}</p>
        {done ? (
          <>
            <p className="ok">Invitation sent. They’ll be notified now{' '}and can join your team room as soon as they accept.</p>
            <div className="row"><Link className="btn primary" to={`/teams/${done.teamId}`} onClick={onClose}>Open the team</Link><button className="btn ghost" onClick={onClose}>Done</button></div>
          </>
        ) : !isPro ? (
          <>
            <p><span className="pill">Pro</span> Sharing a hackathon with a teammate creates a team and a private room for it, which is a Pro feature. You can still join any team or private room you are invited to, and chat there, for free.</p>
            <div className="row"><Link className="btn primary" to="/plan" onClick={onClose}>Unlock Pro</Link><button className="btn ghost" onClick={onClose}>Close</button></div>
          </>
        ) : (
          <form onSubmit={send}>
            {conns.length > 0 && (
              <label>Someone you’re connected with
                <select value={pick} onChange={(e) => { setPick(e.target.value); if (e.target.value) setEmail(''); }}><option value="">Choose…</option>{conns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              </label>
            )}
            <label>{conns.length ? '…or their email' : 'Their email'} <span className="muted small">(they must have a HackElite account)</span>
              <input type="email" value={email} disabled={!!pick} onChange={(e) => setEmail(e.target.value)} placeholder="friend@college.edu" />
            </label>
            <label>Message<textarea rows={2} maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} /></label>
            <div className="row"><button className="btn primary" disabled={busy || (!pick && !email.includes('@'))}>{busy ? 'Sending…' : 'Send invitation'}</button><button type="button" className="btn ghost" onClick={onClose}>Cancel</button></div>
            <p className="small muted">For privacy we never say whether an email has an account. Not connected yet? <Link to="/network" onClick={onClose}>Find people</Link>.</p>
          </form>
        )}
      </div>
    </div>
  );
}

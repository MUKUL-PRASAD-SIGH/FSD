import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { closes, inr, prizeText } from '../components.jsx';
import HackathonAgent from '../HackathonAgent.jsx';
import AddToCalendar from '../AddToCalendar.jsx';

const fmt = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null);
const KIND = { registration: 'Registration closes', submission: 'Submissions close', event_start: 'Starts (register before)', event_end: 'Ends' };

export default function ListingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(null);
  useEffect(() => { api.listing(id).then((r) => { setD(r.listing); setSaved(r.saved); }).catch((e) => setError(e.message)); }, [id]);

  if (error) return <div className="empty"><h2>Listing not available</h2><p>{error}. It may have closed.</p><Link to="/">Back to browse</Link></div>;
  if (!d) return <p className="muted">Loading…</p>;
  const c = closes(d.deadline);
  const prize = prizeText(d.prize);
  const toggle = async () => { if (saved) { await api.unsave(d.id); setSaved(null); } else { await api.saveListing(d.id); setSaved({ status: 'saved' }); } };

  return (
    <article className="detail">
      <p className="small"><Link to="/">← Browse</Link></p>
      <div className="card-top"><span className={`pill ${c.tone}`}>{c.text}</span><span className="muted mono">{d.type.toLowerCase()}</span></div>
      <h1>{d.title}</h1>
      <p className="muted">{d.organiser || 'Organiser'} · listed on {d.platform}{d.alsoOn?.length ? <> · also on {d.alsoOn.map((a, i) => <span key={a.url}>{i ? ', ' : ''}<a href={a.url} target="_blank" rel="noreferrer noopener">{a.platform}</a></span>)}</> : null}</p>
      <div className="detail-actions">
        <a className="btn primary" href={d.url} target="_blank" rel="noreferrer noopener">Register on {d.platform} ↗</a>
        {user && <button className="btn ghost" onClick={toggle} aria-pressed={!!saved}>{saved ? `★ In tracker (${saved.status})` : '☆ Save to tracker'}</button>}
        <AddToCalendar listing={d} />
      </div>
      <dl className="facts">
        <div><dt>{KIND[d.deadlineKind] || 'Deadline'}</dt><dd>{fmt(d.deadline)}</dd></div>
        {d.startDate && <div><dt>Event starts</dt><dd>{fmt(d.startDate)}</dd></div>}
        {d.endDate && <div><dt>Event ends</dt><dd>{fmt(d.endDate)}</dd></div>}
        <div><dt>Format</dt><dd>{d.mode.toLowerCase()}{d.city ? ` · ${d.city}${d.state ? ', ' + d.state : ''}${d.country ? ', ' + d.country : ''}` : ''}</dd></div>
        <div><dt>Prize</dt><dd>{prize ? <>{prize.text}{prize.title && <span className="muted small"> ({prize.title})</span>}</> : 'Not stated'}</dd></div>
        <div><dt>Entry</dt><dd>{d.fee}</dd></div>
        {d.teamMax && <div><dt>Team size</dt><dd>{d.teamMin || 1}–{d.teamMax}</dd></div>}
        {d.registered && <div><dt>Registered</dt><dd>{d.registered.toLocaleString('en-IN')}</dd></div>}
        <div><dt>Eligibility</dt><dd>{d.eligibility?.length ? d.eligibility.join(' · ') : 'Not stated — check the listing'}</dd></div>
      </dl>
      {d.skills?.length > 0 && <p><b>Skills:</b> {d.skills.map((s) => <span key={s} className="pill">{s}</span>)}</p>}
      {d.tags?.length > 0 && <p><b>Themes:</b> {d.tags.map((t) => <span key={t} className="pill">{t}</span>)}</p>}
      {d.description && <section className="panel"><h2>About</h2><p>{d.description}</p></section>}
      <HackathonAgent listing={d} />
      <p className="small muted">Details are copied from {d.platform}; the organiser’s page is the source of truth.{d.prize?.inr && d.prize.currency && d.prize.currency !== 'INR' ? ` Rupee amount is an estimate (${inr(d.prize.inr)}).` : ''}</p>
    </article>
  );
}

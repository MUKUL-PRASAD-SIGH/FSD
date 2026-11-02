import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { closes } from '../components.jsx';

const blank = { title: '', organiser: '', type: 'HACKATHON', mode: 'ONLINE', description: '', url: '', deadline: '', startDate: '', city: '', state: '', venue: '', prizeInr: '', feeInr: '', teamMin: '', teamMax: '', eligibility: [], tags: '', skills: '', contactEmail: '' };
const toLocal = (d) => (d ? new Date(new Date(d).getTime() - new Date(d).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

function ListingForm({ tpl, initial, onSaved, onCancel }) {
  const { user } = useAuth();
  const [f, setF] = useState(initial ? { ...blank, ...initial, deadline: toLocal(initial.deadline), startDate: toLocal(initial.startDate), tags: (initial.tags || []).join(', '), skills: (initial.skills || []).join(', '), prizeInr: initial.prize?.inr ?? '', teamMin: initial.team?.min ?? '', teamMax: initial.team?.max ?? '', feeInr: /\d/.test(initial.fee || '') ? initial.fee.replace(/\D/g, '') : '' } : { ...blank, organiser: user.lister?.organisation || '' });
  const [errs, setErrs] = useState({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const err1 = (k) => errs[k] && <span className="error small">{errs[k]}</span>;
  const inPerson = f.mode !== 'ONLINE';

  async function submit(e) {
    e.preventDefault(); setErrs({}); setErr(''); setBusy(true);
    const body = { ...f, deadline: f.deadline ? new Date(f.deadline).toISOString() : '', startDate: f.startDate ? new Date(f.startDate).toISOString() : '' };
    try { const r = initial ? await api.updateListing(initial.id, body) : await api.createListing(body); onSaved(r.listing); }
    catch (x) { setErr(x.message); setErrs(x.fields || {}); } finally { setBusy(false); }
  }
  const toggle = (v) => setF({ ...f, eligibility: f.eligibility.includes(v) ? f.eligibility.filter((x) => x !== v) : [...f.eligibility, v] });

  return (
    <form className="panel form-grid" onSubmit={submit} noValidate>
      <h2>{initial ? 'Edit event' : 'New event'}</h2>
      <label className="span2">Event title *<input value={f.title} onChange={set('title')} maxLength={200} />{err1('title')}</label>
      <label>Organiser *<input value={f.organiser} onChange={set('organiser')} />{err1('organiser')}</label>
      <label>Type *<select value={f.type} onChange={set('type')}>{tpl.types.map((t) => <option key={t}>{t}</option>)}</select>{err1('type')}</label>
      <label className="span2">Description * <span className="muted small">(what participants will do, rules, judging)</span><textarea rows={5} value={f.description} onChange={set('description')} maxLength={5000} />{err1('description')}</label>
      <label>Mode *<select value={f.mode} onChange={set('mode')}>{tpl.modes.map((t) => <option key={t}>{t}</option>)}</select>{err1('mode')}</label>
      <label>Registration link *<input type="url" placeholder="https://" value={f.url} onChange={set('url')} />{err1('url')}</label>
      <label>Registration deadline *<input type="datetime-local" value={f.deadline} onChange={set('deadline')} />{err1('deadline')}</label>
      <label>Event start <input type="datetime-local" value={f.startDate} onChange={set('startDate')} />{err1('startDate')}</label>
      {inPerson && (
        <>
          <label>City *<input value={f.city} onChange={set('city')} />{err1('city')}</label>
          <label>State<input value={f.state} onChange={set('state')} /></label>
          <label className="span2">Venue<input value={f.venue} onChange={set('venue')} /></label>
        </>
      )}
      <label>Total prize pool (₹)<input type="number" min="0" value={f.prizeInr} onChange={set('prizeInr')} />{err1('prizeInr')}</label>
      <label>Entry fee (₹, blank = free)<input type="number" min="0" value={f.feeInr} onChange={set('feeInr')} /></label>
      <label>Team size (min)<input type="number" min="1" max="20" value={f.teamMin} onChange={set('teamMin')} />{err1('teamMin')}</label>
      <label>Team size (max)<input type="number" min="1" max="20" value={f.teamMax} onChange={set('teamMax')} /></label>
      <fieldset className="span2"><legend>Who can join</legend>
        <div className="chips">{tpl.eligibility.map((x) => <button type="button" key={x} className={`chip ${f.eligibility.includes(x) ? 'on' : ''}`} aria-pressed={f.eligibility.includes(x)} onClick={() => toggle(x)}>{x}</button>)}</div>
      </fieldset>
      <label>Themes / tags <span className="muted small">(comma separated)</span><input value={f.tags} onChange={set('tags')} placeholder="AI, Healthcare" /></label>
      <label>Skills involved <span className="muted small">(helps matching; we also detect them)</span><input value={f.skills} onChange={set('skills')} placeholder="Python, React" /></label>
      <label className="span2">Contact email<input type="email" value={f.contactEmail} onChange={set('contactEmail')} />{err1('contactEmail')}</label>
      {err && <p className="error span2" role="alert">{err}</p>}
      <div className="row span2">
        <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : initial ? 'Save changes' : 'Publish event'}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function Lister() {
  const { user, refresh } = useAuth();
  const [tpl, setTpl] = useState(null);
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null); // null | 'new' | listing
  const [error, setError] = useState('');
  const status = user.lister?.approvalStatus;
  const approved = user.role === 'admin' || status === 'approved';

  const load = () => api.myListings().then((r) => setRows(r.listings)).catch((e) => setError(e.message));
  useEffect(() => { refresh().catch(() => {}); api.template().then(setTpl); load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!approved) {
    return (
      <>
        <h1>Lister dashboard</h1>
        <div className="panel">
          {status === 'rejected'
            ? <><h2>Your request was declined</h2><p className="muted">{user.lister?.reviewNote || 'No reason was given.'}</p></>
            : <><h2>Awaiting admin approval</h2><p className="muted">Thanks, {user.name.split(' ')[0]}. An admin is reviewing <strong>{user.lister?.organisation}</strong>. You’ll get a notification as soon as you can publish events.</p></>}
        </div>
      </>
    );
  }
  async function remove(l) { if (!window.confirm(`Delete “${l.title}”?`)) return; await api.deleteListing(l.id); load(); }

  return (
    <>
      <div className="row-between"><h1>Lister dashboard</h1>{!editing && <button className="btn primary" onClick={() => setEditing('new')}>+ New event</button>}</div>
      <p className="muted">Events you publish appear instantly on Browse and trigger notifications for students whose profile matches.</p>
      {error && <p className="error">{error}</p>}
      {editing && tpl && <ListingForm tpl={tpl} initial={editing === 'new' ? null : editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      <ul className="notes">
        {rows.map((l) => (
          <li key={l.id} className="panel row-between">
            <div><strong>{l.title}</strong><div className="small muted">{l.type.toLowerCase()} · {l.mode.toLowerCase()} · {closes(l.deadline).text} · {l.status}</div></div>
            <div className="row"><button className="btn ghost" onClick={() => setEditing(l)}>Edit</button><button className="btn ghost" onClick={() => remove(l)}>Delete</button></div>
          </li>
        ))}
      </ul>
      {!rows.length && !editing && <div className="empty">No events yet. <Link to="#" onClick={(e) => { e.preventDefault(); setEditing('new'); }}>Publish your first one.</Link></div>}
    </>
  );
}

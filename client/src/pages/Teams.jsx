import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../toast.jsx';

const initials = (n) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function Teams() {
  const { isPro } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [teams, setTeams] = useState(null);
  const [saved, setSaved] = useState([]);
  const [recs, setRecs] = useState(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', listingId: '', maxMembers: 4, visibility: 'private', lookingFor: '', description: '' });

  const load = () => api.teams().then((r) => setTeams(r.teams)).catch(() => setTeams([]));
  useEffect(() => { load(); api.saved().then((r) => setSaved(r.saved)).catch(() => {}); if (isPro) api.recTeams().then((r) => setRecs(r.teams)).catch(() => setRecs([])); }, [isPro]);

  async function create(e) {
    e.preventDefault();
    try {
      const r = await api.createTeam({ ...f, listingId: f.listingId || undefined, maxMembers: Number(f.maxMembers), lookingFor: f.lookingFor.split(',').map((s) => s.trim()).filter(Boolean) });
      toast('Team created', 'good'); nav(`/teams/${r.team.id}`);
    } catch (err) { toast(err.message, 'err'); }
  }
  async function request(t) {
    const message = window.prompt(`Say a few words to the owner of “${t.name}” (optional)`, '');
    if (message === null) return;
    try { await api.requestJoin(t.id, message); toast('Request sent to the team owner', 'good'); setRecs((l) => l.filter((x) => x.id !== t.id)); } catch (err) { toast(err.message, 'err'); }
  }

  return (
    <>
      <div className="row-between"><h1>Teams</h1><button className="btn primary" onClick={() => setOpen(!open)}>{open ? 'Cancel' : '+ New team'}</button></div>
      <p className="muted">A team gets its own private room, an invite list and (with Pro) an idea board. Teams are private unless you make them public.</p>

      {open && (
        <form className="panel form-grid" onSubmit={create}>
          <label className="span2">Team name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} maxLength={80} placeholder="e.g. Pixel Pirates" /></label>
          <label>Hackathon (optional)
            <select value={f.listingId} onChange={(e) => setF({ ...f, listingId: e.target.value })}>
              <option value="">Not tied to one</option>
              {saved.map((s) => <option key={s.listing.id} value={s.listing.id}>{s.listing.title}</option>)}
            </select>
          </label>
          <label>Max members<input type="number" min={2} max={10} value={f.maxMembers} onChange={(e) => setF({ ...f, maxMembers: e.target.value })} /></label>
          <label className="span2">What the team needs <span className="muted small">(skills, comma separated)</span><input value={f.lookingFor} onChange={(e) => setF({ ...f, lookingFor: e.target.value })} placeholder="react, figma" /></label>
          <label className="span2">About<textarea rows={2} maxLength={300} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
          <label className="chk span2"><input type="checkbox" checked={f.visibility === 'public'} disabled={!isPro} onChange={(e) => setF({ ...f, visibility: e.target.checked ? 'public' : 'private' })} /> Public: people can find the team and ask to join {!isPro && <span className="pill">Pro</span>}</label>
          <div className="span2"><button className="btn primary" disabled={f.name.trim().length < 2}>Create team</button> {!saved.length && <span className="muted small"> Tip: save a hackathon in your <Link to="/tracker">tracker</Link> to tie a team to it.</span>}</div>
        </form>
      )}

      {teams === null && <p className="muted">Loading…</p>}
      {teams?.length === 0 && !open && <div className="empty"><h2>No teams yet</h2><p>Create one, or share a hackathon from your <Link to="/tracker">tracker</Link> with a teammate and a team is made for you.</p></div>}
      <div className="grid">
        {teams?.map((t) => (
          <article className="card" key={t.id}>
            <div className="card-top"><span className="pill">{t.visibility}</span>{t.isOwner && <span className="pill okp">owner</span>}<span className="muted mono">{t.members.length}/{t.maxMembers}</span></div>
            <h3><Link to={`/teams/${t.id}`}>{t.name}</Link></h3>
            {t.listing && <p className="muted small">For {t.listing.title}</p>}
            <p className="avatars">{t.members.slice(0, 6).map((m) => <span key={m.id} className="avatar sm" title={m.name}>{initials(m.name)}</span>)}</p>
            <div className="card-actions"><Link className="btn" to={`/teams/${t.id}`}>Open</Link>{t.room && <Link className="btn ghost" to={`/chat/${t.room}`}>Chat</Link>}</div>
          </article>
        ))}
      </div>

      <section className="panel" aria-label="Open teams">
        <h2>Open teams for you {!isPro && <span className="pill">Pro</span>}</h2>
        {!isPro ? <p className="muted">Pro finds public teams with open slots that match your skills and the hackathons you track, and lets you ask to join. <Link to="/plan">Unlock Pro</Link></p>
          : recs === null ? <p className="muted small">Finding teams…</p>
            : !recs.length ? <p className="muted">No open teams right now. Check back soon, or create your own public team.</p>
              : recs.map((t) => (
                <div className="person" key={t.id}>
                  <div className="grow">
                    <strong>{t.name}</strong><span className={`score ${t.matchScore >= 70 ? 'hi' : t.matchScore >= 45 ? 'mid' : 'lo'}`}>{t.matchScore}<small>/100</small></span>
                    <p className="small muted">{t.listing ? `${t.listing.title} · ` : ''}{t.openSlots} open slot{t.openSlots === 1 ? '' : 's'} · led by {t.owner?.name}</p>
                    {t.description && <p className="small">{t.description}</p>}
                    {t.lookingFor.length > 0 && <p className="tags">{t.lookingFor.map((s) => <span key={s} className="tag">{s}</span>)}</p>}
                    <ul className="why">{t.matchReasons.slice(0, 3).map((r) => <li key={r}>{r}</li>)}</ul>
                  </div>
                  <div className="actions"><button className="btn primary" onClick={() => request(t)}>Ask to join</button></div>
                </div>
              ))}
      </section>
    </>
  );
}

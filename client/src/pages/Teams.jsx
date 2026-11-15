import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../toast.jsx';
import { Avatar, CountUp, Reveal, Ring, hueOf } from '../ui.jsx';
import './teams.css';

const lc = (s) => String(s).toLowerCase();

// Skills the members bring (top 6, as a segmented bar) and which of the team's "looking for" needs are already covered.
function coverage(t) {
  const counts = new Map();
  t.members.forEach((m) => (m.skills || []).forEach((s) => counts.set(lc(s), (counts.get(lc(s)) || 0) + 1)));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const have = new Set(counts.keys());
  return { top, total: top.reduce((a, [, n]) => a + n, 0), needs: (t.lookingFor || []).map((s) => ({ s, ok: have.has(lc(s)) })) };
}
const SEG = ['var(--accent)', 'var(--cyan)', 'var(--lime)', '#0B2A78', '#7fe9ff', '#8fb2ff'];

function Seats({ members, max }) {
  const empty = Math.max(0, Math.min(max, 8) - members.length);
  return (
    <div className="tm-seats" aria-label={`${members.length} of ${max} seats filled`}>
      {members.slice(0, 8).map((m, i) => <span key={m.id} className="tm-seat" style={{ '--i': i }} title={m.name}><Avatar name={m.name} size={40} ring={m.role === 'owner'} /></span>)}
      {Array.from({ length: empty }, (_, i) => <span key={`e${i}`} className="tm-seat empty" style={{ '--i': members.length + i }} aria-hidden="true">+</span>)}
      <b className="tm-count">{members.length}<small>/{max}</small></b>
    </div>
  );
}

function Squad({ t, i = 0, preview }) {
  const cov = useMemo(() => coverage(t), [t]);
  const h = hueOf(t.name || 'team');
  const days = t.listing ? Math.ceil((new Date(t.listing.deadline) - Date.now()) / 86400000) : null;
  return (
    <article className={`tm-card h${h} ${preview ? 'preview' : ''}`} style={{ '--i': Math.min(i, 8) }}>
      <div className="tm-top">
        <span className="tm-vis">{t.visibility}</span>{t.isOwner && <span className="tm-vis own">owner</span>}
        {days != null && <span className={`tm-due ${days <= 3 ? 'hot' : ''}`}>◷ {days <= 0 ? 'closes today' : `${days}d left`}</span>}
      </div>
      <h3>{preview ? (t.name || 'Your team name') : <Link to={`/teams/${t.id}`}>{t.name}</Link>}</h3>
      {t.listing && <p className="tm-for">For {t.listing.title}</p>}
      <Seats members={t.members} max={t.maxMembers} />
      {cov.total > 0 && (
        <div className="tm-cov" aria-label="Skills in this team">
          <div className="tm-covbar">{cov.top.map(([s, n], k) => <i key={s} style={{ flexGrow: n, background: SEG[k] }} title={`${s} · ${n}`} />)}</div>
          <p>{cov.top.slice(0, 4).map(([s], k) => <span key={s}><i style={{ background: SEG[k] }} />{s}</span>)}</p>
        </div>
      )}
      {cov.needs.length > 0 && <p className="tm-needs"><small>Looking for</small>{cov.needs.map((n) => <span key={n.s} className={n.ok ? 'ok' : ''}>{n.ok ? '✓ ' : ''}{n.s}</span>)}</p>}
      {!preview && <div className="tm-actions"><Link className="btn primary" to={`/teams/${t.id}`}>Open</Link>{t.room && <Link className="btn ghost" to={`/chat/${t.room}`}>Chat</Link>}</div>}
    </article>
  );
}

export default function Teams() {
  const { isPro, user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [teams, setTeams] = useState(null);
  const [saved, setSaved] = useState([]);
  const [recs, setRecs] = useState(null);
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(new Set());
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
    try {
      await api.requestJoin(t.id, message); toast('Request sent to the team owner', 'good');
      setSent((s) => new Set(s).add(t.id)); setTimeout(() => setRecs((l) => l.filter((x) => x.id !== t.id)), 1100);
    } catch (err) { toast(err.message, 'err'); }
  }

  const preview = {
    name: f.name, visibility: f.visibility, maxMembers: Number(f.maxMembers) || 4, isOwner: true, lookingFor: f.lookingFor.split(',').map((s) => s.trim()).filter(Boolean),
    listing: saved.find((s) => s.listing.id === f.listingId)?.listing || null,
    members: [{ id: 'me', name: user.name, role: 'owner', skills: user.skills || [] }],
  };
  const seatsOpen = (teams || []).reduce((a, t) => a + Math.max(0, t.maxMembers - t.members.length), 0);

  return (
    <div className="tm">
      <header className="tm-head">
        <div>
          <p className="tm-kicker">Collaboration workspace</p>
          <h1>Teams</h1>
          <p className="tm-sub">A team gets its own private room and an invite list. Pro members create and host teams; anyone invited can join and chat for free.</p>
        </div>
        <button className="btn primary" onClick={() => setOpen(!open)}>{open ? 'Cancel' : '+ New team'}</button>
      </header>

      {teams?.length > 0 && (
        <div className="tm-stats">
          <div><b><CountUp value={teams.length} /></b><span>your teams</span></div>
          <div><b><CountUp value={seatsOpen} /></b><span>open seats</span></div>
          <div><b><CountUp value={teams.filter((t) => t.listing).length} /></b><span>tied to a hackathon</span></div>
        </div>
      )}

      {open && !isPro && (
        <div className="tm-upsell">
          <h2>Hosting a team is a Pro feature <span className="pill">Pro</span></h2>
          <p>Pro lets you create a hackathon team with its own private room, invite people by connection or email, and use the idea board. You can still join any team or private room you are invited to, and chat there, for free. <Link to="/plan">Unlock Pro</Link></p>
        </div>
      )}
      {open && isPro && (
        <div className="tm-builder">
          <form className="tm-form" onSubmit={create}>
            <h2>Assemble a team</h2>
            <label>Team name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} maxLength={80} placeholder="e.g. Pixel Pirates" /></label>
            <div className="tm-two">
              <label>Hackathon (optional)
                <select value={f.listingId} onChange={(e) => setF({ ...f, listingId: e.target.value })}>
                  <option value="">Not tied to one</option>
                  {saved.map((s) => <option key={s.listing.id} value={s.listing.id}>{s.listing.title}</option>)}
                </select>
              </label>
              <label>Seats<input type="number" min={2} max={10} value={f.maxMembers} onChange={(e) => setF({ ...f, maxMembers: e.target.value })} /></label>
            </div>
            <label>What the team needs <span className="muted small">(skills, comma separated)</span><input value={f.lookingFor} onChange={(e) => setF({ ...f, lookingFor: e.target.value })} placeholder="react, figma" /></label>
            <label>About<textarea rows={2} maxLength={300} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
            <label className="switch"><input type="checkbox" checked={f.visibility === 'public'} disabled={!isPro} onChange={(e) => setF({ ...f, visibility: e.target.checked ? 'public' : 'private' })} /><i />Public: people can find the team and ask to join</label>
            <div><button className="btn primary" disabled={f.name.trim().length < 2}>Create team</button> {!saved.length && <span className="muted small"> Tip: save a hackathon in your <Link to="/tracker">tracker</Link> to tie a team to it.</span>}</div>
          </form>
          <div className="tm-preview"><p className="tm-kicker">Live preview</p><Squad t={preview} preview /></div>
        </div>
      )}

      {teams === null && <div className="tm-grid">{[0, 1].map((k) => <div key={k} className="tm-card tm-skel" />)}</div>}
      {teams?.length === 0 && !open && (
        <div className="tm-empty">
          <div className="tm-empty-art" aria-hidden="true">{[0, 1, 2].map((k) => <span key={k} style={{ '--k': k }}>+</span>)}</div>
          <h2>No teams yet</h2>
          <p>{isPro ? <>Create one, or share a hackathon from your <Link to="/tracker">tracker</Link> with a teammate and a team is made for you.</> : <>Teams you are invited to appear here. Creating your own is a Pro feature. <Link to="/plan">Unlock Pro</Link></>}</p>
        </div>
      )}
      {teams?.length > 0 && <div className="tm-grid">{teams.map((t, i) => <Squad key={t.id} t={t} i={i} />)}</div>}

      <section className="tm-open" aria-label="Open teams">
        <h2>Open teams for you {!isPro && <span className="pill">Pro</span>}</h2>
        {!isPro ? <p className="muted">Pro finds public teams with open slots that match your skills and the hackathons you track, and lets you ask to join. <Link to="/plan">Unlock Pro</Link></p>
          : recs === null ? <p className="muted small">Finding teams…</p>
            : !recs.length ? <p className="muted">No open teams right now. Check back soon, or create your own public team.</p>
              : (
                <div className="tm-rail">
                  {recs.map((t) => (
                    <Reveal as="article" className={`tm-rec ${sent.has(t.id) ? 'sent' : ''}`} key={t.id}>
                      <Ring value={t.matchScore} size={64} stroke={6} label={t.matchScore} />
                      <div className="tm-rec-main">
                        <strong>{t.name}</strong>
                        <p className="small muted">{t.listing ? `${t.listing.title} · ` : ''}{t.openSlots} open slot{t.openSlots === 1 ? '' : 's'} · led by {t.owner?.name}</p>
                        {t.description && <p className="small">{t.description}</p>}
                        {t.lookingFor.length > 0 && <p className="tm-needs"><small>Needs</small>{t.lookingFor.map((s) => <span key={s}>{s}</span>)}</p>}
                        <ul className="tm-why">{t.matchReasons.slice(0, 3).map((r) => <li key={r}>{r}</li>)}</ul>
                      </div>
                      {sent.has(t.id) ? <span className="tm-sent"><i aria-hidden="true">✓</i> Request sent</span> : <button className="btn primary" onClick={() => request(t)}>Ask to join</button>}
                    </Reveal>
                  ))}
                </div>
              )}
      </section>
    </div>
  );
}

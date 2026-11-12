import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../toast.jsx';
import ChatPane from '../ChatPane.jsx';

const initials = (n) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

function IdeaBoard({ teamId, isPro }) {
  const { user } = useAuth();
  const toast = useToast();
  const [ideas, setIdeas] = useState(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  useEffect(() => { if (isPro) api.ideas(teamId).then((r) => setIdeas(r.ideas)).catch(() => setIdeas([])); }, [teamId, isPro]);
  if (!isPro) return <section className="panel"><h2>Idea board <span className="pill">Pro</span></h2><p className="muted">Pitch ideas and vote as a team: each member has a 1st choice (10 points) and a 2nd choice (5 points). <Link to="/plan">Unlock Pro</Link></p></section>;
  const run = async (fn) => { try { const r = await fn(); if (r?.ideas) setIdeas(r.ideas); } catch (e) { toast(e.message, 'err'); } };
  return (
    <section className="panel">
      <h2>Idea board</h2>
      <p className="small muted">Vote for others’ ideas: 1st choice = 10 points, 2nd choice = 5. Moving a vote replaces the old one.</p>
      <form className="row" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.addIdea(teamId, { title, description: desc }); setTitle(''); setDesc(''); return api.ideas(teamId); }); }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Pitch an idea (3+ characters)" minLength={3} maxLength={120} style={{ flex: 1, minWidth: 200 }} aria-label="Idea title" />
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="One line on why (optional)" maxLength={500} style={{ flex: 2, minWidth: 200 }} aria-label="Idea description" />
        <button className="btn primary" disabled={title.trim().length < 3}>Add</button>
      </form>
      {ideas === null && <p className="muted small">Loading…</p>}
      {ideas?.length === 0 && <p className="muted">No ideas yet. Be the first to pitch one.</p>}
      {ideas?.map((i, n) => (
        <div className="person" key={i.id}>
          <span className="rank">{n + 1}</span>
          <div className="grow"><strong>{i.title}</strong><span className="score">{i.score}<small> pts</small></span>{i.description && <p className="small muted">{i.description}</p>}</div>
          <div className="actions">
            {i.author !== user.id && <>
              <button className={`chip ${i.myRank === 1 ? 'on' : ''}`} aria-pressed={i.myRank === 1} onClick={() => run(() => api.voteIdea(teamId, i.id, 1))}>1st · 10</button>
              <button className={`chip ${i.myRank === 2 ? 'on' : ''}`} aria-pressed={i.myRank === 2} onClick={() => run(() => api.voteIdea(teamId, i.id, 2))}>2nd · 5</button>
            </>}
            {(i.author === user.id) && <button className="link small" onClick={() => run(async () => { await api.deleteIdea(teamId, i.id); return api.ideas(teamId); })}>Delete</button>}
          </div>
        </div>
      ))}
    </section>
  );
}

export default function TeamPage() {
  const { id } = useParams();
  const { user, isPro } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [team, setTeam] = useState(null);
  const [error, setError] = useState('');
  const [conns, setConns] = useState([]);
  const [email, setEmail] = useState('');
  const [pick, setPick] = useState('');
  const [msg, setMsg] = useState('');
  const [edit, setEdit] = useState(null);

  const load = useCallback(() => api.team(id).then((r) => { setTeam(r.team); setEdit((e) => e || { name: r.team.name, maxMembers: r.team.maxMembers, visibility: r.team.visibility, lookingFor: r.team.lookingFor.join(', '), description: r.team.description }); }).catch((e) => setError(e.message)), [id]);
  useEffect(() => { setTeam(null); setEdit(null); load(); api.overview().then((o) => setConns(o.connections)).catch(() => {}); }, [load]);
  useEffect(() => { window.addEventListener('hackelite:notification', load); return () => window.removeEventListener('hackelite:notification', load); }, [load]);

  if (error) return <div className="empty"><h2>Team not found</h2><p>{error}</p><Link to="/teams">Back to teams</Link></div>;
  if (!team) return <p className="muted">Loading…</p>;
  const run = async (fn, ok) => { try { const r = await fn(); if (ok) toast(ok, 'good'); await load(); return r; } catch (e) { toast(e.message, 'err'); return null; } };
  const invitable = conns.filter((c) => !team.members.some((m) => m.id === c.id) && !team.pendingInvites.some((p) => p.to?.id === c.id));

  async function save(e) {
    e.preventDefault();
    await run(() => api.updateTeam(id, { name: edit.name, maxMembers: Number(edit.maxMembers), visibility: edit.visibility, description: edit.description, lookingFor: edit.lookingFor.split(',').map((s) => s.trim()).filter(Boolean) }), 'Team updated');
  }

  return (
    <>
      <p className="small"><Link to="/teams">← Teams</Link></p>
      <div className="row-between"><h1>{team.name}</h1><span className="pill">{team.visibility}</span></div>
      {team.listing && <p className="muted">Team for <a href={team.listing.url} target="_blank" rel="noreferrer noopener">{team.listing.title} ↗</a> · closes {new Date(team.listing.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>}
      {team.description && <p>{team.description}</p>}

      <div className="two-col">
        <div>
          <section className="panel">
            <h2>Members <span className="muted">{team.members.length}/{team.maxMembers}</span></h2>
            {team.members.map((m) => (
              <div className="person" key={m.id}>
                <span className="avatar">{initials(m.name)}</span>
                <div className="grow"><strong>{m.name}</strong> {m.role === 'owner' && <span className="pill okp">owner</span>}{m.headline && <p className="small muted">{m.headline}</p>}{m.skills.length > 0 && <p className="tags">{m.skills.slice(0, 5).map((s) => <span key={s} className="tag">{s}</span>)}</p>}</div>
                {team.isOwner && m.id !== user.id && (
                  <div className="actions">
                    <button className="link small" onClick={() => window.confirm(`Make ${m.name} the owner? You will become a regular member.`) && run(() => api.transferTeam(id, m.id), 'Ownership transferred')}>Make owner</button>
                    <button className="link small" onClick={() => window.confirm(`Remove ${m.name} from the team?`) && run(() => api.removeMember(id, m.id), 'Removed')}>Remove</button>
                  </div>
                )}
              </div>
            ))}
            {team.pendingInvites.length > 0 && <><h3>Pending</h3>{team.pendingInvites.map((p) => <div className="person" key={p.id}><div className="grow">{p.to?.name || 'Invited'} <span className="muted small">({p.kind === 'team_request' ? 'asked to join' : 'invited'})</span></div></div>)}</>}
          </section>

          {team.isOwner && team.openSlots > 0 && !isPro && (
            <section className="panel upsell">
              <h2>Invite someone <span className="pill">Pro</span></h2>
              <p className="muted">Inviting people to a team is a Pro feature. Your existing team and room keep working. <Link to="/plan">Unlock Pro</Link></p>
            </section>
          )}
          {team.isOwner && team.openSlots > 0 && isPro && (
            <section className="panel">
              <h2>Invite someone</h2>
              <p className="small muted">They get an in-app notification{' '}(and an email if they allow it). When they accept they join this team and its private room, and the hackathon is added to their tracker.</p>
              {invitable.length > 0 && (
                <div className="row">
                  <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Pick a connection"><option value="">Pick a connection…</option>{invitable.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                  <button className="btn primary" disabled={!pick} onClick={() => run(async () => { await api.inviteToTeam(id, { userId: pick, message: msg }); setPick(''); }, 'Invitation sent')}>Invite</button>
                </div>
              )}
              <form className="row" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await api.inviteToTeam(id, { email, message: msg }); setEmail(''); toast(r.message, 'good'); }); }} style={{ marginTop: 8 }}>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="…or type their email (registered users only)" aria-label="Email" style={{ flex: 1, minWidth: 200 }} />
                <button className="btn" disabled={!email.includes('@')}>Send invite</button>
              </form>
              <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Add a short message (optional)" maxLength={300} aria-label="Message" style={{ marginTop: 8, width: '100%' }} />
            </section>
          )}

          <IdeaBoard teamId={id} isPro={isPro} />

          <section className="panel">
            <h2>Team settings</h2>
            {team.isOwner ? (
              <form className="form-grid" onSubmit={save}>
                <label className="span2">Name<input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} minLength={2} maxLength={80} /></label>
                <label>Max members<input type="number" min={Math.max(2, team.members.length)} max={10} value={edit.maxMembers} onChange={(e) => setEdit({ ...edit, maxMembers: e.target.value })} /></label>
                <label>Visibility<select value={edit.visibility} onChange={(e) => setEdit({ ...edit, visibility: e.target.value })}><option value="private">Private</option><option value="public" disabled={!isPro}>Public {isPro ? '' : '(Pro)'}</option></select></label>
                <label className="span2">Looking for <span className="muted small">(skills)</span><input value={edit.lookingFor} onChange={(e) => setEdit({ ...edit, lookingFor: e.target.value })} /></label>
                <label className="span2">About<textarea rows={2} maxLength={300} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></label>
                <div className="span2 row"><button className="btn primary">Save</button><button type="button" className="link" onClick={() => window.confirm('Disband this team? Its room and messages are deleted for everyone.') && run(async () => { await api.disbandTeam(id); nav('/teams'); }, 'Team disbanded')}>Disband team</button></div>
              </form>
            ) : <button className="btn ghost" onClick={() => window.confirm('Leave this team? You will lose access to its room.') && run(async () => { await api.leaveTeam(id); nav('/teams'); }, 'You left the team')}>Leave team</button>}
          </section>
        </div>

        <section className="panel teamchat" aria-label="Team room">
          <h2>🔒 Team room</h2>
          <p className="small muted">Only team members can read this.</p>
          {team.room && <ChatPane roomId={team.room} empty="This is your team’s private room. Say hello 👋" />}
        </section>
      </div>
    </>
  );
}

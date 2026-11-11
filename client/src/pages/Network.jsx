import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useRealtime } from '../realtime.jsx';
import { useToast } from '../toast.jsx';

const initials = (n) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const Avatar = ({ name }) => <span className="avatar" aria-hidden="true">{initials(name)}</span>;

function Person({ p, children, score }) {
  return (
    <div className="person">
      <Avatar name={p.name} />
      <div className="grow">
        <strong>{p.name}</strong>{score != null && <span className={`score ${score >= 70 ? 'hi' : score >= 45 ? 'mid' : 'lo'}`} title="Match score out of 100">{score}<small>/100</small></span>}
        {p.headline && <p className="small muted">{p.headline}</p>}
        {p.skills?.length > 0 && <p className="tags">{p.skills.slice(0, 6).map((s) => <span key={s} className="tag">{s}</span>)}</p>}
        {p.matchReasons?.length > 0 && <ul className="why">{p.matchReasons.slice(0, 3).map((r) => <li key={r}>{r}</li>)}</ul>}
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}

export default function Network() {
  const { user, setUser, isPro } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const { refresh } = useRealtime();
  const [ov, setOv] = useState(null);
  const [q, setQ] = useState('');
  const [found, setFound] = useState(null);
  const [smart, setSmart] = useState(false);
  const [email, setEmail] = useState('');
  const [sug, setSug] = useState(null);
  const [blocked, setBlocked] = useState([]);

  const load = useCallback(() => api.overview().then(setOv).catch((e) => toast(e.message, 'err')), [toast]);
  useEffect(() => { load(); window.addEventListener('hackelite:notification', load); return () => window.removeEventListener('hackelite:notification', load); }, [load]);
  useEffect(() => { if (isPro) api.recTeammates().then(setSug).catch(() => setSug({ teammates: [] })); }, [isPro, user.social?.discoverable]);
  useEffect(() => {
    if (q.trim().length < 2) { setFound(null); return undefined; }
    const t = setTimeout(() => api.people(q.trim()).then((r) => { setFound(r.people); setSmart(r.smart); }).catch(() => setFound([])), 300);
    return () => clearTimeout(t);
  }, [q]);

  const act = async (fn, ok) => { try { const r = await fn(); if (ok) toast(typeof ok === 'function' ? ok(r) : ok, 'good'); await load(); refresh(); return r; } catch (e) { toast(e.message, 'err'); return null; } };
  const connect = (p) => act(() => api.connect({ userId: p.id }), (r) => (r.status === 'accepted' ? `You are now connected with ${p.name}` : `Request sent to ${p.name}`)).then(() => { setFound((l) => l?.map((x) => (x.id === p.id ? { ...x, relation: 'pending' } : x))); setSug((s) => s && { ...s, teammates: s.teammates.map((x) => (x.id === p.id ? { ...x, relation: 'pending' } : x)) }); });
  const message = async (id) => { try { const r = await api.openDm(id); nav(`/chat/${r.roomId}`); } catch (e) { toast(e.message, 'err'); } };
  const setSocial = async (patch) => { try { const r = await api.updateProfile({ social: patch }); setUser(r.user); toast('Saved', 'good'); } catch (e) { toast(e.message, 'err'); } };
  const relBtn = (p) => (p.relation === 'accepted' ? <button className="btn" onClick={() => message(p.id)}>Message</button> : p.relation === 'pending' ? <span className="pill">Requested</span> : <button className="btn primary" onClick={() => connect(p)}>Connect</button>);

  if (!ov) return <><h1>Network</h1><p className="muted">Loading…</p></>;
  const invites = ov.invites.incoming;
  const waiting = ov.incoming.length + invites.length;

  return (
    <>
      <h1>Network</h1>
      <p className="muted">Connect with other hackers, team up on a hackathon and chat privately. Everything here is private to the people involved.</p>

      {!user.social?.discoverable && (
        <div className="panel upsell">
          <strong>You are hidden.</strong> People can only find you by your exact email. Turn on discovery so teammates can find you by name{isPro ? ' and show up in teammate recommendations' : ''}. Only your name, headline and skills are shown, never your email.
          <div className="row" style={{ marginTop: 8 }}><button className="btn primary" onClick={() => setSocial({ discoverable: true })}>Let teammates find me</button></div>
        </div>
      )}

      {waiting > 0 && (
        <section className="panel" aria-label="Requests and invitations">
          <h2>Waiting for you <span className="pill warm">{waiting}</span></h2>
          {ov.incoming.map((p) => (
            <Person key={p.requestId} p={p}>
              <span className="small muted">wants to connect</span>
              <button className="btn primary" onClick={() => act(() => api.acceptRequest(p.requestId), `Connected with ${p.name}`)}>Accept</button>
              <button className="btn ghost" onClick={() => act(() => api.declineRequest(p.requestId))}>Decline</button>
            </Person>
          ))}
          {invites.map((i) => (
            <div className="person" key={i.id}>
              <Avatar name={i.from?.name || '?'} />
              <div className="grow">
                <strong>{i.from?.name}</strong> <span className="muted small">{i.kind === 'team_request' ? `wants to join your team “${i.team?.name}”` : i.kind === 'team_invite' ? `invited you to the team “${i.team?.name}”` : `invited you to the private room “${i.room?.name}”`}</span>
                {i.message && <p className="small muted">“{i.message}”</p>}
              </div>
              <div className="actions">
                <button className="btn primary" onClick={async () => { const r = await act(() => api.acceptInvite(i.id), i.kind === 'room_invite' ? 'You joined the room' : i.kind === 'team_request' ? 'They are now in your team' : 'You joined the team'); if (r?.roomId) nav(`/chat/${r.roomId}`); else if (r?.teamId && i.kind === 'team_invite') nav(`/teams/${r.teamId}`); }}>Accept</button>
                <button className="btn ghost" onClick={() => act(() => api.declineInvite(i.id))}>Decline</button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="panel" aria-label="Find people">
        <h2>Find people</h2>
        <div className="ask"><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={isPro ? 'Try “react designers looking for a team”' : 'Search by name'} aria-label="Search people" /></div>
        {!isPro && <p className="small muted">Pro adds plain-English search by skill and “looking for a team”. <Link to="/plan">Unlock Pro</Link></p>}
        {found && (found.length ? found.map((p) => <Person key={p.id} p={p}>{relBtn(p)}</Person>) : <p className="muted small">No one found. They may not have turned on discovery yet. You can invite them by email below.</p>)}
        <form className="row" onSubmit={(e) => { e.preventDefault(); act(() => api.connect({ email }), (r) => r.message).then(() => setEmail('')); }} style={{ marginTop: 12 }}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Invite by email (they must have an account)" aria-label="Email address" style={{ flex: 1, minWidth: 220 }} />
          <button className="btn" disabled={!email.includes('@')}>Send request</button>
        </form>
      </section>

      <section className="panel" aria-label="Suggested teammates">
        <h2>Suggested teammates {!isPro && <span className="pill">Pro</span>}</h2>
        {!isPro ? <p className="muted">Pro ranks people who complement your skills, track the same hackathons as you, or are looking for a team. <Link to="/plan">Unlock Pro</Link></p>
          : !sug ? <p className="muted small">Finding matches…</p>
            : !sug.teammates.length ? <p className="muted">No suggestions yet. {user.social?.discoverable ? 'As more people turn on discovery they will appear here.' : 'Turn on discovery above so others can find you too.'}</p>
              : sug.teammates.map((p) => <Person key={p.id} p={p} score={p.matchScore}>{relBtn(p)}</Person>)}
      </section>

      <section className="panel" aria-label="Your connections">
        <h2>Your connections <span className="muted">{ov.connections.length}</span></h2>
        {!ov.connections.length && <p className="muted">No connections yet. Search above or accept a request to get started.</p>}
        {ov.connections.map((p) => (
          <Person key={p.id} p={p}>
            <button className="btn primary" onClick={() => message(p.id)}>Message</button>
            <button className="link small" onClick={() => window.confirm(`Remove ${p.name} from your connections?`) && act(() => api.removeConnection(p.id), 'Removed')}>Remove</button>
            <button className="link small" onClick={() => window.confirm(`Block ${p.name}? They won't be able to contact you or invite you.`) && act(() => api.blockUser(p.id), 'Blocked')}>Block</button>
          </Person>
        ))}
        {ov.outgoing.length > 0 && <><h3>Sent requests</h3>{ov.outgoing.map((p) => <Person key={p.requestId} p={p}><span className="pill">Pending</span><button className="link small" onClick={() => act(() => api.cancelRequest(p.requestId))}>Cancel</button></Person>)}</>}
        {ov.invites.outgoing.length > 0 && <><h3>Sent invitations</h3>{ov.invites.outgoing.map((i) => <div className="person" key={i.id}><Avatar name={i.to?.name || '?'} /><div className="grow"><strong>{i.to?.name}</strong> <span className="muted small">invited to {i.team?.name || i.room?.name}</span></div><div className="actions"><span className="pill">Pending</span><button className="link small" onClick={() => act(() => api.cancelInvite(i.id))}>Cancel</button></div></div>)}</>}
        <details onToggle={(e) => e.target.open && api.blocked().then((r) => setBlocked(r.blocked)).catch(() => {})}>
          <summary className="small muted">Blocked people</summary>
          {blocked.length ? blocked.map((p) => <Person key={p.id} p={p}><button className="btn ghost" onClick={() => api.unblockUser(p.id).then(() => setBlocked((l) => l.filter((x) => x.id !== p.id)))}>Unblock</button></Person>) : <p className="small muted">Nobody blocked.</p>}
        </details>
      </section>
    </>
  );
}

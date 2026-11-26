import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useRealtime } from '../realtime.jsx';
import { useToast } from '../toast.jsx';
import { Avatar, CountUp, Ring, hueOf } from '../ui.jsx';
import './network.css';

const initials = (n) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const GRAD = [['#145BFF', '#22C8FF'], ['#22C8FF', '#C6FF00'], ['#145BFF', '#0B2A78'], ['#C6FF00', '#22C8FF'], ['#0B2A78', '#22C8FF'], ['#145BFF', '#C6FF00']];

// Your people as a constellation: you in the middle, connections on orbits, pending requests as dashed outer nodes.
function Graph({ me, conns, waiting, sent, onOpen }) {
  const MAX = 13;
  const shown = conns.slice(0, MAX);
  const extra = conns.length - shown.length;
  const nodes = [];
  shown.forEach((p, i) => {
    const inner = i < 6; const idx = inner ? i : i - 6; const count = inner ? Math.min(6, shown.length) : shown.length - 6;
    const a = (Math.PI * 2 * idx) / count + (inner ? -Math.PI / 2 : -Math.PI / 2 + 0.4);
    const r = inner ? 108 : 172;
    nodes.push({ p, x: 300 + Math.cos(a) * r * 1.55, y: 180 + Math.sin(a) * r * 0.95, kind: 'conn', n: i });
  });
  const pend = [...waiting.map((p) => ({ p, k: 'in' })), ...sent.map((p) => ({ p, k: 'out' }))].slice(0, 6);
  pend.forEach((x, i) => { const a = (Math.PI * 2 * i) / Math.max(pend.length, 1) + 0.9; nodes.push({ p: x.p, x: 300 + Math.cos(a) * 262, y: 180 + Math.sin(a) * 158, kind: x.k, n: shown.length + i }); });
  return (
    <svg className="nw-graph" viewBox="0 0 600 360" role="group" aria-label={`Your network: ${conns.length} connection${conns.length === 1 ? '' : 's'}`}>
      <defs>{GRAD.map(([a, b], i) => <linearGradient key={i} id={`ng${i}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient>)}</defs>
      <ellipse className="nw-orbit" cx="300" cy="180" rx="167" ry="103" /><ellipse className="nw-orbit o2" cx="300" cy="180" rx="267" ry="165" />
      {nodes.map((nd) => <line key={`l${nd.p.id || nd.p.requestId}`} className={`nw-edge ${nd.kind}`} x1="300" y1="180" x2={nd.x} y2={nd.y} style={{ '--n': nd.n }} />)}
      <g className="nw-me"><circle cx="300" cy="180" r="38" className="nw-me-halo" /><circle cx="300" cy="180" r="30" fill="url(#ng0)" /><text x="300" y="186" textAnchor="middle">{initials(me)}</text></g>
      {nodes.map((nd) => {
        const h = hueOf(nd.p.name); const dark = h === 1 || h === 3; const act = nd.kind === 'conn';
        return (
          <g key={`n${nd.p.id || nd.p.requestId}`} className={`nw-node ${nd.kind}`} transform={`translate(${nd.x} ${nd.y})`} style={{ '--n': nd.n }} tabIndex={act ? 0 : -1} role={act ? 'button' : undefined} aria-label={act ? `Message ${nd.p.name}` : `${nd.p.name}, ${nd.kind === 'in' ? 'wants to connect' : 'request pending'}`} onClick={act ? () => onOpen(nd.p.id) : undefined} onKeyDown={act ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(nd.p.id); } } : undefined}>
            <circle r={act ? 22 : 17} fill={act ? `url(#ng${h})` : 'var(--bg)'} className="nw-disc" />
            <text y="4" textAnchor="middle" fill={act ? (dark ? '#0a1400' : '#fff') : 'var(--muted)'}>{initials(nd.p.name)}</text>
            <g className="nw-tip" transform="translate(0 -34)"><rect x="-58" y="-17" width="116" height="26" rx="13" /><text y="1" textAnchor="middle">{nd.p.name.length > 16 ? `${nd.p.name.slice(0, 15)}…` : nd.p.name}</text></g>
          </g>
        );
      })}
      {extra > 0 && <text className="nw-more" x="300" y="352" textAnchor="middle">+{extra} more connection{extra === 1 ? '' : 's'}</text>}
      {!conns.length && !pend.length && <text className="nw-more" x="300" y="262" textAnchor="middle">Your network starts here</text>}
    </svg>
  );
}

function PersonCard({ p, score, children, i = 0 }) {
  const h = hueOf(p.name);
  return (
    <article className={`nw-card h${h}`} style={{ '--i': Math.min(i, 10) }}>
      <div className="nw-cover" aria-hidden="true" />
      <div className="nw-card-top"><Avatar name={p.name} size={60} ring={score >= 70} />{score != null && <Ring value={score} size={52} stroke={5} label={score} />}</div>
      <h3>{p.name}</h3>
      {p.headline && <p className="nw-head">{p.headline}</p>}
      {p.skills?.length > 0 && <p className="nw-skills">{p.skills.slice(0, 5).map((s) => <span key={s}>{s}</span>)}{p.skills.length > 5 && <em>+{p.skills.length - 5}</em>}</p>}
      {p.matchReasons?.length > 0 && <ul className="nw-reasons">{p.matchReasons.slice(0, 3).map((r) => <li key={r}>{r}</li>)}</ul>}
      <div className="nw-actions">{children}</div>
    </article>
  );
}

function Row({ p, children, text }) {
  return (
    <div className="nw-row">
      <Avatar name={p.name || '?'} size={44} />
      <div className="nw-row-main"><strong>{p.name}</strong> {text && <span className="muted small">{text}</span>}{p.headline && <p className="small muted">{p.headline}</p>}</div>
      <div className="nw-row-actions">{children}</div>
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
  const [tab, setTab] = useState('discover');

  const load = useCallback(() => api.overview().then(setOv).catch((e) => toast(e.message, 'err')), [toast]);
  useEffect(() => {
    load();
    const poll = setInterval(load, 15000);
    const onFocus = () => { if (document.visibilityState === 'visible') load(); };
    window.addEventListener('hackelite:notification', load);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => { clearInterval(poll); window.removeEventListener('hackelite:notification', load); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, [load]);
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
  const relBtn = (p) => (p.relation === 'accepted' ? <button className="btn" onClick={() => message(p.id)}>Message</button> : p.relation === 'pending' ? <span className="nw-sent"><span aria-hidden="true">✓</span> Requested</span> : <button className="btn primary nw-connect" onClick={() => connect(p)}>Connect</button>);

  const waitingPeople = ov?.incoming || [];
  const stats = useMemo(() => ov && ({ conns: ov.connections.length, waiting: ov.incoming.length + ov.invites.incoming.length, sent: ov.outgoing.length + ov.invites.outgoing.length }), [ov]);
  if (!ov) return <div className="nw"><h1>Network</h1><div className="nw-skel" /></div>;
  const invites = ov.invites.incoming;
  const waiting = ov.incoming.length + invites.length;

  return (
    <div className="nw">
      <section className="nw-hero">
        <div className="nw-hero-copy">
          <p className="nw-kicker">Community and connections</p>
          <h1>Your network</h1>
          <p>Connect with other hackers, team up on a hackathon and chat privately. Everything here is private to the people involved.</p>
          <div className="nw-stats">
            <div><b><CountUp value={stats.conns} /></b><span>connections</span></div>
            <div><b><CountUp value={stats.waiting} /></b><span>waiting</span></div>
            <div><b><CountUp value={stats.sent} /></b><span>sent</span></div>
          </div>
          {user.social?.discoverable
            ? <p className="nw-visible"><span /> You’re discoverable. <Link to="/profile">Manage in settings</Link></p>
            : (
              <div className="nw-hidden">
                <strong>You are hidden.</strong> People can only find you by your exact email. Turn on discovery so teammates can find you by name{isPro ? ' and show up in teammate recommendations' : ''}. Only your name, headline and skills are shown, never your email.
                <div><button className="btn primary" onClick={() => setSocial({ discoverable: true })}>Let teammates find me</button></div>
              </div>
            )}
        </div>
        <Graph me={user.name} conns={ov.connections} waiting={waitingPeople} sent={ov.outgoing} onOpen={message} />
      </section>

      <div className="nw-tabs" role="tablist" aria-label="Network sections">
        {[['discover', 'Discover'], ['requests', 'Requests', waiting], ['connections', 'Connections', ov.connections.length]].map(([v, l, n]) => (
          <button key={v} role="tab" aria-selected={tab === v} className={tab === v ? 'on' : ''} onClick={() => setTab(v)}>{l}{n > 0 && <span>{n}</span>}</button>
        ))}
      </div>

      {tab === 'discover' && (
        <div className="nw-pane" role="tabpanel">
          <section className="nw-find" aria-label="Find people">
            <div className="nw-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={isPro ? 'Try “react designers looking for a team”' : 'Search by name'} aria-label="Search people" /></div>
            {!isPro && <p className="small muted">Pro adds plain-English search by skill and “looking for a team”. <Link to="/plan">Unlock Pro</Link></p>}
            {found && (found.length ? <div className="nw-grid">{found.map((p, i) => <PersonCard key={p.id} p={p} i={i}>{relBtn(p)}</PersonCard>)}</div> : <p className="muted small">No one found. They may not have turned on discovery yet. You can invite them by email below.</p>)}
            {smart && found?.length > 0 && <p className="small muted">Ranked by skills and what you asked for.</p>}
            <form className="nw-email" onSubmit={(e) => { e.preventDefault(); act(() => api.connect({ email }), (r) => r.message).then(() => setEmail('')); }}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Invite by email (they must have an account)" aria-label="Email address" />
              <button className="btn" disabled={!email.includes('@')}>Send request</button>
            </form>
          </section>

          <section aria-label="Suggested teammates">
            <h2 className="nw-h">Suggested teammates {!isPro && <span className="pill">Pro</span>}</h2>
            {!isPro ? <p className="muted">Pro ranks people who complement your skills, track the same hackathons as you, or are looking for a team. <Link to="/plan">Unlock Pro</Link></p>
              : !sug ? <p className="muted small">Finding matches…</p>
                : !sug.teammates.length ? <p className="muted">No suggestions yet. {user.social?.discoverable ? 'As more people turn on discovery they will appear here.' : 'Turn on discovery above so others can find you too.'}</p>
                  : <div className="nw-grid">{sug.teammates.map((p, i) => <PersonCard key={p.id} p={p} score={p.matchScore} i={i}>{relBtn(p)}</PersonCard>)}</div>}
          </section>
        </div>
      )}

      {tab === 'requests' && (
        <div className="nw-pane" role="tabpanel">
          {waiting === 0 && <div className="nw-empty"><div className="nw-empty-art" aria-hidden="true"><i /><i /></div><h2>No one is waiting on you</h2><p>Connection requests and team invitations show up here.</p></div>}
          {waiting > 0 && (
            <section className="nw-list" aria-label="Requests and invitations">
              {ov.incoming.map((p) => (
                <Row key={p.requestId} p={p} text="wants to connect">
                  <button className="btn primary" onClick={() => act(() => api.acceptRequest(p.requestId), `Connected with ${p.name}`)}>Accept</button>
                  <button className="btn ghost" onClick={() => act(() => api.declineRequest(p.requestId))}>Decline</button>
                </Row>
              ))}
              {invites.map((i) => (
                <Row key={i.id} p={{ name: i.from?.name || '?' }} text={i.kind === 'team_request' ? `wants to join your team “${i.team?.name}”` : i.kind === 'team_invite' ? `invited you to the team “${i.team?.name}”` : `invited you to the private room “${i.room?.name}”`}>
                  {i.message && <p className="small muted nw-msg">“{i.message}”</p>}
                  <button className="btn primary" onClick={async () => { const r = await act(() => api.acceptInvite(i.id), i.kind === 'room_invite' ? 'You joined the room' : i.kind === 'team_request' ? 'They are now in your team' : 'You joined the team'); if (r?.roomId) nav(`/chat/${r.roomId}`); else if (r?.teamId && i.kind === 'team_invite') nav(`/teams/${r.teamId}`); }}>Accept</button>
                  <button className="btn ghost" onClick={() => act(() => api.declineInvite(i.id))}>Decline</button>
                </Row>
              ))}
            </section>
          )}
        </div>
      )}

      {tab === 'connections' && (
        <div className="nw-pane" role="tabpanel">
          <section aria-label="Your connections">
            {!ov.connections.length && <div className="nw-empty"><div className="nw-empty-art" aria-hidden="true"><i /><i /></div><h2>No connections yet</h2><p>Search in Discover or accept a request to get started.</p><button className="btn primary" onClick={() => setTab('discover')}>Find people</button></div>}
            <div className="nw-grid">
              {ov.connections.map((p, i) => (
                <PersonCard key={p.id} p={p} i={i}>
                  <button className="btn primary" onClick={() => message(p.id)}>Message</button>
                  <button className="link small" onClick={() => window.confirm(`Remove ${p.name} from your connections?`) && act(() => api.removeConnection(p.id), 'Removed')}>Remove</button>
                  <button className="link small" onClick={() => window.confirm(`Block ${p.name}? They won't be able to contact you or invite you.`) && act(() => api.blockUser(p.id), 'Blocked')}>Block</button>
                </PersonCard>
              ))}
            </div>
            {ov.outgoing.length > 0 && <><h3 className="nw-h">Sent requests</h3><div className="nw-list">{ov.outgoing.map((p) => <Row key={p.requestId} p={p}><span className="pill">Pending</span><button className="link small" onClick={() => act(() => api.cancelRequest(p.requestId))}>Cancel</button></Row>)}</div></>}
            {ov.invites.outgoing.length > 0 && <><h3 className="nw-h">Sent invitations</h3><div className="nw-list">{ov.invites.outgoing.map((i) => <Row key={i.id} p={{ name: i.to?.name || '?' }} text={`invited to ${i.team?.name || i.room?.name}`}><span className="pill">Pending</span><button className="link small" onClick={() => act(() => api.cancelInvite(i.id))}>Cancel</button></Row>)}</div></>}
            <details className="nw-blocked" onToggle={(e) => e.target.open && api.blocked().then((r) => setBlocked(r.blocked)).catch(() => {})}>
              <summary className="small muted">Blocked people</summary>
              {blocked.length ? blocked.map((p) => <Row key={p.id} p={p}><button className="btn ghost" onClick={() => api.unblockUser(p.id).then(() => setBlocked((l) => l.filter((x) => x.id !== p.id)))}>Unblock</button></Row>) : <p className="small muted">Nobody blocked.</p>}
            </details>
          </section>
        </div>
      )}
    </div>
  );
}

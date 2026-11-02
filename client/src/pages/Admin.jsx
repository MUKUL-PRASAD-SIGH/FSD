import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

function Stats({ tick }) {
  const [s, setS] = useState(null);
  useEffect(() => { api.adminStats().then(setS).catch(() => {}); }, [tick]);
  if (!s) return null;
  return (
    <dl className="stats">
      <div><dt>pending listers</dt><dd>{s.pendingListers}</dd></div>
      <div><dt>users</dt><dd>{s.users.user || 0}</dd></div>
      <div><dt>listers</dt><dd>{s.users.lister || 0}</dd></div>
      <div><dt>pro users</dt><dd>{s.proUsers}</dd></div>
      <div><dt>open listings</dt><dd>{s.openListings}</dd></div>
    </dl>
  );
}

function Listers({ onChange }) {
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState([]);
  const [note, setNote] = useState({});
  const load = useCallback(() => api.adminListers(status).then((r) => setRows(r.listers)), [status]);
  useEffect(() => { load(); }, [load]);
  async function decide(l, d) { await api.decideLister(l.id, d, note[l.id] || ''); load(); onChange?.(); }
  return (
    <section>
      <div className="seg">{['pending', 'approved', 'rejected'].map((s) => <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{s}</button>)}</div>
      {rows.map((l) => (
        <div key={l.id} className="panel">
          <strong>{l.name}</strong> <span className="muted small">{l.email}</span>
          <p className="small"><b>{l.lister.organisation}</b>{l.lister.website && <> · <a href={l.lister.website} target="_blank" rel="noreferrer noopener">{l.lister.website}</a></>}</p>
          {l.lister.reason && <p className="muted small">“{l.lister.reason}”</p>}
          {status === 'pending' ? (
            <div className="row">
              <input placeholder="Note to the lister (optional)" value={note[l.id] || ''} onChange={(e) => setNote({ ...note, [l.id]: e.target.value })} />
              <button className="btn primary" onClick={() => decide(l, 'approve')}>Approve</button>
              <button className="btn ghost" onClick={() => decide(l, 'reject')}>Reject</button>
            </div>
          ) : <p className="small muted">{l.lister.reviewNote}</p>}
        </div>
      ))}
      {!rows.length && <div className="empty">Nothing {status}.</div>}
    </section>
  );
}

function Users() {
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [rows, setRows] = useState([]);
  const load = useCallback(() => api.adminUsers(q, role).then((r) => setRows(r.users)), [q, role]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);
  const patch = async (u, b) => { await api.patchUser(u.id, b).catch((e) => window.alert(e.message)); load(); };
  return (
    <section>
      <div className="filters"><input type="search" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role"><option value="">all roles</option><option>user</option><option>lister</option><option>admin</option></select></div>
      <table className="tbl"><thead><tr><th>Name</th><th>Role</th><th>Plan</th><th>Status</th><th /></tr></thead>
        <tbody>{rows.map((u) => (
          <tr key={u.id}><td>{u.name}<div className="small muted">{u.email}{u.googleLinked ? ' · Google' : ''}</div></td>
            <td><select value={u.role} onChange={(e) => patch(u, { role: e.target.value })} aria-label={`Role for ${u.name}`}><option>user</option><option>lister</option><option>admin</option></select></td>
            <td><select value={u.plan} onChange={(e) => patch(u, { plan: e.target.value })} aria-label={`Plan for ${u.name}`}><option>free</option><option>pro</option></select></td>
            <td>{u.status}</td>
            <td><button className="btn ghost" onClick={() => patch(u, { status: u.status === 'active' ? 'disabled' : 'active' })}>{u.status === 'active' ? 'Disable' : 'Enable'}</button></td></tr>
        ))}</tbody></table>
    </section>
  );
}

function Listings() {
  const [rows, setRows] = useState([]);
  const [src, setSrc] = useState('manual');
  const load = useCallback(() => api.adminListings('').then((r) => setRows(r.listings.filter((l) => !src || l.source === src))), [src]);
  useEffect(() => { load(); }, [load]);
  return (
    <section>
      <div className="seg">{[['manual', 'Lister events'], ['', 'All sources']].map(([v, l]) => <button key={l} className={src === v ? 'on' : ''} onClick={() => setSrc(v)}>{l}</button>)}</div>
      <table className="tbl"><thead><tr><th>Title</th><th>Source</th><th>Status</th><th /></tr></thead>
        <tbody>{rows.map((l) => (
          <tr key={l._id}><td>{l.title}<div className="small muted">{l.organiser}</div></td><td>{l.source}</td><td>{l.status}</td>
            <td><button className="btn ghost" onClick={async () => { await api.patchListing(l._id, l.status === 'published' ? 'unpublished' : 'published'); load(); }}>{l.status === 'published' ? 'Unpublish' : 'Publish'}</button></td></tr>
        ))}</tbody></table>
      {!rows.length && <div className="empty">No listings here.</div>}
    </section>
  );
}

function Audit() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.adminAudit().then((r) => setRows(r.events)); }, []);
  return (
    <section>
      <table className="tbl"><thead><tr><th>When</th><th>Action</th><th>Actor</th><th>IP</th></tr></thead>
        <tbody>{rows.map((e) => <tr key={e.id}><td className="small">{new Date(e.at).toLocaleString('en-IN')}</td><td className="mono">{e.action}</td><td>{e.actor?.email || '—'}</td><td className="small muted">{e.ip}</td></tr>)}</tbody></table>
    </section>
  );
}

export default function Admin() {
  const [tab, setTab] = useState('listers');
  const [msg, setMsg] = useState('');
  const [tick, setTick] = useState(0);
  const tabs = { listers: Listers, users: Users, listings: Listings, audit: Audit };
  const Tab = tabs[tab];
  return (
    <>
      <div className="row-between"><h1>Admin console</h1><button className="btn ghost" onClick={async () => { const r = await api.runNotifier(); setMsg(`Notifier ran: ${r.created} new notifications`); }}>Run notifier</button></div>
      {msg && <p className="ok small" role="status">{msg}</p>}
      <Stats tick={tick} />
      <div className="seg">{Object.keys(tabs).map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
      <Tab onChange={() => setTick((t) => t + 1)} />
    </>
  );
}

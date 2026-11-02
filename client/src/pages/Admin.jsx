import { Fragment, useCallback, useEffect, useState } from 'react';
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

const ago = (d) => { if (!d) return 'never'; const m = Math.round((Date.now() - new Date(d)) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const STATUS_TONE = { ok: 'okp', partial: 'warm', failed: 'hot', skipped: '' };

// Source coverage: one row per adapter with the numbers from its latest sync
function Sources() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [openRow, setOpenRow] = useState('');
  const load = useCallback(() => api.adminSources().then(setData).catch((e) => setMsg(e.message)), []);
  useEffect(() => { load(); }, [load]);
  async function sync(sources) {
    setBusy(true); setMsg('Syncing… this can take a few minutes for every source.');
    try { const r = await api.runIngest(sources); setMsg(`Sync finished: ${r.totals.stored} distinct listings, ${r.totals.duplicates} cross-source duplicates merged.`); load(); }
    catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }
  if (!data) return <p className="muted">{msg || 'Loading source coverage…'}</p>;
  return (
    <section>
      <div className="row-between">
        <p className="muted small">{data.totalLive} open listings from ingestion · {data.manualListings} from verified listers{data.sampleListings ? ` · ${data.sampleListings} offline sample listings (removed after the first successful sync)` : ''}</p>
        <button className="btn primary" disabled={busy} onClick={() => sync([])}>{busy ? 'Syncing…' : 'Sync all now'}</button>
      </div>
      {msg && <p className="small" role="status">{msg}</p>}
      <div className="tbl-wrap">
        <table className="tbl cov">
          <thead><tr><th>Source</th><th>Status</th><th>Last success</th><th title="Open listings currently stored">Live</th><th title="Records the source returned">Raw</th><th>Valid</th><th>Expired</th><th title="Repeats in the feed + same opportunity on another source">Dup.</th><th>Rejected</th><th>Pages</th><th /></tr></thead>
          <tbody>{data.sources.map((s) => {
            const r = s.lastRun;
            return (
              <Fragment key={s.source}>
                <tr>
                  <td><b>{s.label}</b><div className="small muted mono">{s.source}</div></td>
                  <td>{r ? <span className={`pill ${STATUS_TONE[r.status]}`}>{r.status}</span> : <span className="pill">never run</span>}</td>
                  <td className="small">{ago(s.lastSuccessAt)}</td>
                  <td className="num"><b>{s.liveListings}</b></td>
                  <td className="num">{r?.raw ?? '—'}</td><td className="num">{r?.valid ?? '—'}</td><td className="num">{r?.expired ?? '—'}</td>
                  <td className="num">{r?.duplicates ?? '—'}</td><td className="num">{r?.rejected ?? '—'}</td>
                  <td className="small">{r?.pages ? `${r.pages.fetched}${r.pages.expected != null ? '/' + r.pages.expected : ''} ${r.pages.complete ? '✓ complete' : r.pages.capped ? '⚠ capped' : '⚠ incomplete'}` : '—'}</td>
                  <td><button className="link small" onClick={() => setOpenRow(openRow === s.source ? '' : s.source)} aria-expanded={openRow === s.source}>details</button> <button className="link small" disabled={busy} onClick={() => sync([s.source])}>sync</button></td>
                </tr>
                {openRow === s.source && (
                  <tr className="cov-detail"><td colSpan={11}>
                    {r?.error && <p className="error small">Error: {r.error}</p>}
                    {r?.skippedReason && <p className="small">Skipped: {r.skippedReason}. Add the credentials in .env and restart.</p>}
                    {r && Object.keys(r.rejectReasons || {}).length > 0 && <p className="small">Rejected because: {Object.entries(r.rejectReasons).map(([k, v]) => `${k.replace(/_/g, ' ')} (${v})`).join(', ')}</p>}
                    {r?.rejectSamples?.length > 0 && <ul className="small muted">{r.rejectSamples.map((x, i) => <li key={i}>{x.reason}: {x.title || '(no title)'} <span className="mono">{x.externalId}</span></li>)}</ul>}
                    {r && <p className="small muted">Stored as primary: {r.stored} · removed as no longer listed: {r.removedStale} · took {Math.round((r.durationMs || 0) / 1000)} s</p>}
                    {!r && <p className="small muted">This source has not been synced yet.</p>}
                  </td></tr>
                )}
              </Fragment>
            );
          })}</tbody>
        </table>
      </div>
    </section>
  );
}

function Integrations() {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = () => { setBusy(true); api.adminIntegrations().then((r) => setRows(r.checks)).finally(() => setBusy(false)); };
  useEffect(run, []);
  return (
    <section>
      <div className="row-between"><p className="muted small">Each check makes a real request with the configured credentials.</p><button className="btn ghost" disabled={busy} onClick={run}>{busy ? 'Checking…' : 'Re-check'}</button></div>
      {!rows ? <p className="muted">Checking…</p> : (
        <table className="tbl"><thead><tr><th>Integration</th><th>Status</th><th>Detail</th></tr></thead>
          <tbody>{rows.map((c) => <tr key={c.name}><td className="mono">{c.name}</td><td><span className={`pill ${!c.configured ? '' : c.ok ? 'okp' : 'hot'}`}>{!c.configured ? 'not configured' : c.ok ? 'working' : 'failing'}</span></td><td className="small">{c.detail}</td></tr>)}</tbody></table>
      )}
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
  const [tab, setTab] = useState('sources');
  const [msg, setMsg] = useState('');
  const [tick, setTick] = useState(0);
  const tabs = { sources: Sources, listers: Listers, users: Users, listings: Listings, integrations: Integrations, audit: Audit };
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

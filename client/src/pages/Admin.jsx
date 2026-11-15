import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { Avatar, CountUp, Reveal, Ring } from '../ui.jsx';
import './admin.css';

const ago = (d) => { if (!d) return 'never'; const m = Math.round((Date.now() - new Date(d)) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const STATUS_TONE = { ok: 'okp', partial: 'warm', failed: 'hot', skipped: '' };

function Tile({ label, value, tone, hint, delay }) {
  return <Reveal className={`ad-tile ${tone || ''}`} delay={delay}><span>{label}</span><b><CountUp value={value} /></b>{hint && <small>{hint}</small>}</Reveal>;
}

// Overview: headline numbers, listings by source, source health and what needs attention (all live data)
function Overview({ go }) {
  const [s, setS] = useState(null);
  const [src, setSrc] = useState(null);
  useEffect(() => { api.adminStats().then(setS).catch(() => {}); api.adminSources().then(setSrc).catch(() => {}); }, []);
  const rows = useMemo(() => (src?.sources || []).filter((x) => x.liveListings > 0).sort((a, b) => b.liveListings - a.liveListings).slice(0, 8), [src]);
  const max = Math.max(1, ...rows.map((r) => r.liveListings));
  const health = useMemo(() => {
    const c = { ok: 0, partial: 0, failed: 0, skipped: 0, never: 0 };
    (src?.sources || []).forEach((x) => { c[x.lastRun ? x.lastRun.status : 'never'] = (c[x.lastRun ? x.lastRun.status : 'never'] || 0) + 1; });
    const total = (src?.sources || []).length || 1;
    return { c, pct: Math.round((c.ok / total) * 100) };
  }, [src]);
  const attention = (src?.sources || []).filter((x) => !x.lastRun || ['failed', 'partial'].includes(x.lastRun.status));
  const accounts = s ? Object.values(s.users).reduce((a, b) => a + b, 0) : 0;
  return (
    <div className="ad-over">
      {s && (
        <div className="ad-tiles">
          <Tile label="Open listings" value={s.openListings} delay={0} />
          <Tile label="Users" value={s.users.user || 0} delay={60} />
          <Tile label="Listers" value={s.users.lister || 0} delay={120} />
          <Tile label="Pro users" value={s.proUsers} tone="lime" delay={180} />
          <Tile label="Pending listers" value={s.pendingListers} tone={s.pendingListers ? 'warm' : ''} hint={s.pendingListers ? 'needs review' : 'all clear'} delay={240} />
        </div>
      )}
      <div className="ad-cols">
        <section className="ad-card wide">
          <h2>Live listings by source</h2>
          <div className="ad-bars">
            {rows.map((r, n) => <div key={r.source}><span>{r.label}</span><i><u style={{ '--w': `${(r.liveListings / max) * 100}%`, '--n': n }} /></i><b>{r.liveListings}</b></div>)}
            {!src && <p className="muted small">Loading…</p>}
          </div>
          {src && <p className="muted small">{src.totalLive} from ingestion · {src.manualListings} from verified listers</p>}
        </section>
        <section className="ad-card">
          <h2>Source health</h2>
          <div className="ad-health"><Ring value={health.pct} size={112} stroke={11} label={`${health.pct}%`} sub="healthy" tone={health.pct >= 70 ? 'hi' : health.pct >= 40 ? 'mid' : 'lo'} />
            <ul>{[['ok', 'working'], ['partial', 'partial'], ['failed', 'failing'], ['skipped', 'skipped'], ['never', 'never run']].map(([k, l]) => <li key={k}><i className={k} />{l}<b>{health.c[k] || 0}</b></li>)}</ul>
          </div>
        </section>
        <section className="ad-card">
          <h2>Pro adoption</h2>
          <div className="ad-health"><Ring value={accounts ? Math.round(((s?.proUsers || 0) / accounts) * 100) : 0} size={112} stroke={11} label={`${accounts ? Math.round(((s?.proUsers || 0) / accounts) * 100) : 0}%`} sub="of accounts" tone="hi" /><p className="muted small">{s?.proUsers || 0} of {accounts} accounts are on Pro.</p></div>
        </section>
        <section className="ad-card wide">
          <h2>Needs attention {attention.length + (s?.pendingListers || 0) > 0 && <span className="ad-count">{attention.length + (s?.pendingListers || 0)}</span>}</h2>
          <ul className="ad-attn">
            {s?.pendingListers > 0 && <li><span className="pill warm">review</span>{s.pendingListers} lister application{s.pendingListers === 1 ? '' : 's'} waiting<button className="link small" onClick={() => go('listers')}>Open</button></li>}
            {attention.slice(0, 6).map((x) => <li key={x.source}><span className={`pill ${x.lastRun ? STATUS_TONE[x.lastRun.status] : ''}`}>{x.lastRun ? x.lastRun.status : 'never run'}</span>{x.label}<button className="link small" onClick={() => go('sources')}>Inspect</button></li>)}
            {s && !attention.length && !s.pendingListers && <li className="ad-ok">✓ Everything is running normally.</li>}
          </ul>
        </section>
      </div>
    </div>
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
      <div className="ad-stack">
        {rows.map((l) => (
          <div key={l.id} className="ad-lister">
            <Avatar name={l.name} size={44} />
            <div className="ad-lister-main">
              <strong>{l.name}</strong> <span className="muted small">{l.email}</span>
              <p className="small"><b>{l.lister.organisation}</b>{l.lister.website && <> · <a href={l.lister.website} target="_blank" rel="noreferrer noopener">{l.lister.website}</a></>}</p>
              {l.lister.reason && <p className="muted small">“{l.lister.reason}”</p>}
              {status !== 'pending' && <p className="small muted">{l.lister.reviewNote}</p>}
            </div>
            {status === 'pending' && (
              <div className="ad-decide">
                <input placeholder="Note to the lister (optional)" value={note[l.id] || ''} onChange={(e) => setNote({ ...note, [l.id]: e.target.value })} />
                <button className="btn primary" onClick={() => decide(l, 'approve')}>Approve</button>
                <button className="btn ghost" onClick={() => decide(l, 'reject')}>Reject</button>
              </div>
            )}
          </div>
        ))}
      </div>
      {!rows.length && <div className="ad-empty"><span aria-hidden="true">✓</span>Nothing {status}.</div>}
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
      <div className="ad-filters"><input type="search" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role"><option value="">all roles</option><option>user</option><option>lister</option><option>admin</option></select><span className="muted small">{rows.length} shown</span></div>
      <div className="tbl-wrap"><table className="tbl ad-tbl"><thead><tr><th>Name</th><th>Role</th><th>Plan</th><th>Status</th><th /></tr></thead>
        <tbody>{rows.map((u) => (
          <tr key={u.id}><td><div className="ad-person"><Avatar name={u.name} size={34} /><div>{u.name}<div className="small muted">{u.email}{u.googleLinked ? ' · Google' : ''}</div></div></div></td>
            <td><select value={u.role} onChange={(e) => patch(u, { role: e.target.value })} aria-label={`Role for ${u.name}`}><option>user</option><option>lister</option><option>admin</option></select></td>
            <td><select value={u.plan} onChange={(e) => patch(u, { plan: e.target.value })} aria-label={`Plan for ${u.name}`}><option>free</option><option>pro</option></select></td>
            <td><span className={`pill ${u.status === 'active' ? 'okp' : 'hot'}`}>{u.status}</span></td>
            <td><button className="btn ghost" onClick={() => patch(u, { status: u.status === 'active' ? 'disabled' : 'active' })}>{u.status === 'active' ? 'Disable' : 'Enable'}</button></td></tr>
        ))}</tbody></table></div>
    </section>
  );
}

function Listings() {
  const [rows, setRows] = useState([]);
  const [src, setSrc] = useState('manual');
  const [q, setQ] = useState('');
  const load = useCallback(() => api.adminListings('').then((r) => setRows(r.listings.filter((l) => !src || l.source === src))), [src]);
  useEffect(() => { load(); }, [load]);
  const shown = rows.filter((l) => l.title.toLowerCase().includes(q.toLowerCase()));
  return (
    <section>
      <div className="ad-filters">
        <div className="seg">{[['manual', 'Lister events'], ['', 'All sources']].map(([v, l]) => <button key={l} className={src === v ? 'on' : ''} onClick={() => setSrc(v)}>{l}</button>)}</div>
        <input type="search" placeholder="Filter by title" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter listings" />
      </div>
      <div className="tbl-wrap"><table className="tbl ad-tbl"><thead><tr><th>Title</th><th>Source</th><th>Status</th><th /></tr></thead>
        <tbody>{shown.map((l) => (
          <tr key={l._id}><td>{l.title}<div className="small muted">{l.organiser}</div></td><td>{l.source}</td><td><span className={`pill ${l.status === 'published' ? 'okp' : ''}`}>{l.status}</span></td>
            <td><button className="btn ghost" onClick={async () => { await api.patchListing(l._id, l.status === 'published' ? 'unpublished' : 'published'); load(); }}>{l.status === 'published' ? 'Unpublish' : 'Publish'}</button></td></tr>
        ))}</tbody></table></div>
      {!shown.length && <div className="ad-empty">No listings here.</div>}
    </section>
  );
}

const COLS = [['label', 'Source'], ['status', 'Status'], ['last', 'Last success'], ['live', 'Live', 'Open listings currently stored'], ['raw', 'Raw', 'Records the source returned'], ['valid', 'Valid'], ['expired', 'Expired'], ['dup', 'Dup.', 'Repeats in the feed + same opportunity on another source'], ['rejected', 'Rejected']];
const val = (s, k) => ({ label: s.label.toLowerCase(), status: s.lastRun?.status || 'zzz', last: s.lastSuccessAt ? new Date(s.lastSuccessAt).getTime() : 0, live: s.liveListings, raw: s.lastRun?.raw ?? -1, valid: s.lastRun?.valid ?? -1, expired: s.lastRun?.expired ?? -1, dup: s.lastRun?.duplicates ?? -1, rejected: s.lastRun?.rejected ?? -1 }[k]);

// Source coverage: one row per adapter with the numbers from its latest sync. Click a header to sort.
function Sources() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [openRow, setOpenRow] = useState('');
  const [sort, setSort] = useState({ k: 'live', dir: -1 });
  const [only, setOnly] = useState('');
  const load = useCallback(() => api.adminSources().then(setData).catch((e) => setMsg(e.message)), []);
  useEffect(() => { load(); }, [load]);
  async function sync(sources) {
    setBusy(true); setMsg('Syncing… this can take a few minutes for every source.');
    try { const r = await api.runIngest(sources); setMsg(`Sync finished: ${r.totals.stored} distinct listings, ${r.totals.duplicates} cross-source duplicates merged.`); load(); }
    catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }
  const rows = useMemo(() => {
    if (!data) return [];
    const list = data.sources.filter((s) => !only || (s.lastRun?.status || 'never') === only);
    return [...list].sort((a, b) => { const x = val(a, sort.k); const y = val(b, sort.k); return (x > y ? 1 : x < y ? -1 : 0) * sort.dir; });
  }, [data, sort, only]);
  if (!data) return <p className="muted">{msg || 'Loading source coverage…'}</p>;
  const maxLive = Math.max(1, ...data.sources.map((s) => s.liveListings));
  const kinds = ['ok', 'partial', 'failed', 'skipped', 'never'];
  return (
    <section>
      <div className="row-between">
        <p className="muted small">{data.totalLive} open listings from ingestion · {data.manualListings} from verified listers{data.sampleListings ? ` · ${data.sampleListings} offline sample listings (removed after the first successful sync)` : ''}</p>
        <button className="btn primary" disabled={busy} onClick={() => sync([])}>{busy ? 'Syncing…' : 'Sync all now'}</button>
      </div>
      {msg && <p className="small" role="status">{msg}</p>}
      <div className="ad-chips" role="group" aria-label="Filter by status"><button className={!only ? 'on' : ''} onClick={() => setOnly('')}>All {data.sources.length}</button>{kinds.map((k) => { const n = data.sources.filter((s) => (s.lastRun?.status || 'never') === k).length; return n ? <button key={k} className={only === k ? 'on' : ''} onClick={() => setOnly(only === k ? '' : k)}>{k} {n}</button> : null; })}</div>
      <div className="tbl-wrap">
        <table className="tbl cov ad-tbl">
          <thead><tr>
            {COLS.map(([k, l, t]) => <th key={k} title={t} aria-sort={sort.k === k ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}><button className="ad-th" onClick={() => setSort((p) => ({ k, dir: p.k === k ? -p.dir : (k === 'label' ? 1 : -1) }))}>{l}{sort.k === k && <span aria-hidden="true">{sort.dir > 0 ? ' ▴' : ' ▾'}</span>}</button></th>)}
            <th>Pages</th><th />
          </tr></thead>
          <tbody>{rows.map((s) => {
            const r = s.lastRun;
            return (
              <Fragment key={s.source}>
                <tr>
                  <td><b>{s.label}</b><div className="small muted mono">{s.source}</div></td>
                  <td>{r ? <span className={`pill ${STATUS_TONE[r.status]}`}>{r.status}</span> : <span className="pill">never run</span>}</td>
                  <td className="small">{ago(s.lastSuccessAt)}</td>
                  <td className="num"><div className="ad-live"><b>{s.liveListings}</b><i><u style={{ '--w': `${(s.liveListings / maxLive) * 100}%` }} /></i></div></td>
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
        <div className="ad-int">
          {rows.map((c, n) => {
            const st = !c.configured ? 'off' : c.ok ? 'ok' : 'bad';
            return <Reveal key={c.name} className={`ad-int-card ${st}`} delay={n * 50}><div><i className="dot" /><b className="mono">{c.name}</b></div><span className={`pill ${!c.configured ? '' : c.ok ? 'okp' : 'hot'}`}>{!c.configured ? 'not configured' : c.ok ? 'working' : 'failing'}</span><p className="small">{c.detail}</p></Reveal>;
          })}
        </div>
      )}
    </section>
  );
}

const tone = (a = '') => (a.startsWith('auth') ? 'blue' : a.startsWith('admin') || a.startsWith('lister') ? 'lime' : 'cyan');
function Audit() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  useEffect(() => { api.adminAudit().then((r) => setRows(r.events)); }, []);
  const groups = useMemo(() => {
    const m = new Map();
    rows.filter((e) => `${e.action} ${e.actor?.email || ''} ${e.ip || ''}`.toLowerCase().includes(q.toLowerCase())).forEach((e) => { const d = new Date(e.at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }); if (!m.has(d)) m.set(d, []); m.get(d).push(e); });
    return [...m.entries()];
  }, [rows, q]);
  return (
    <section>
      <div className="ad-filters"><input type="search" placeholder="Filter by action, actor or IP" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter audit log" /><span className="muted small">{groups.reduce((a, [, l]) => a + l.length, 0)} events</span></div>
      <div className="ad-feed">
        {groups.map(([day, list]) => (
          <div key={day}><h3>{day}</h3>
            <ul>{list.map((e) => <li key={e.id}><time>{new Date(e.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</time><span className={`ad-act ${tone(e.action)}`}>{e.action}</span><span className="ad-who">{e.actor?.email || '—'}</span><span className="muted small mono">{e.ip}</span></li>)}</ul>
          </div>
        ))}
        {!groups.length && <div className="ad-empty">No events match.</div>}
      </div>
    </section>
  );
}

const TABS = [['overview', 'Overview', '◎'], ['sources', 'Sources', '⇄'], ['listers', 'Listers', '✓'], ['users', 'Users', '☺'], ['listings', 'Listings', '▤'], ['integrations', 'Integrations', '⚙'], ['audit', 'Audit log', '≣']];
export default function Admin() {
  const [tab, setTab] = useState('overview');
  const [msg, setMsg] = useState('');
  const [tick, setTick] = useState(0);
  const map = { overview: Overview, sources: Sources, listers: Listers, users: Users, listings: Listings, integrations: Integrations, audit: Audit };
  const Tab = map[tab];
  return (
    <div className="ad">
      <aside className="ad-nav" aria-label="Admin sections">
        <p className="ad-brand">Control centre</p>
        {TABS.map(([k, l, g]) => <button key={k} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)}><span aria-hidden="true">{g}</span>{l}</button>)}
        <button className="ad-notify" onClick={async () => { const r = await api.runNotifier(); setMsg(`Notifier ran: ${r.created} new notifications`); }}>▶ Run notifier</button>
      </aside>
      <section className="ad-body">
        <header className="ad-head"><h1>{TABS.find((t) => t[0] === tab)[1]}</h1>{msg && <span className="ok small" role="status">{msg}</span>}</header>
        <Tab key={tab} go={setTab} tick={tick} onChange={() => setTick((t) => t + 1)} />
      </section>
    </div>
  );
}

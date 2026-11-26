import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../toast.jsx';

// Everything that needs a human decision: confusing listings, user reports, colleges users added.
const SEV = { 3: 'hot', 2: 'warm', 1: '' };
const REASON = { wrong_dates: 'wrong dates', wrong_prize: 'wrong prize', wrong_location: 'wrong location', broken_link: 'broken link', duplicate: 'duplicate', spam_or_fake: 'spam / fake', closed: 'already closed', other: 'other' };

function CollegeRow({ c, onDone }) {
  const toast = useToast();
  const [mode, setMode] = useState('');
  const [name, setName] = useState(c.name);
  const [q, setQ] = useState('');
  const [matches, setMatches] = useState([]);
  useEffect(() => { if (mode === 'merge' && q.trim().length >= 2) api.adminColleges(q).then((r) => setMatches(r.colleges.filter((x) => x._id !== c.id))).catch(() => {}); }, [q, mode, c.id]);
  const act = async (body, msg) => { try { await api.patchCollege(c.id, body); toast(msg, 'good'); onDone(); } catch (e) { toast(e.message, 'err'); } };
  return (
    <tr>
      <td><strong>{c.name}</strong>{c.city && <span className="muted small"> · {c.city}</span>}<br /><span className="small muted">added by {c.by?.name || 'unknown'} · {c.users} profile(s)</span></td>
      <td>
        {!mode && (
          <div className="row">
            <button className="btn ghost" onClick={() => act({ action: 'approve' }, 'Approved')}>Approve</button>
            <button className="btn ghost" onClick={() => setMode('rename')}>Rename</button>
            <button className="btn ghost" onClick={() => setMode('merge')}>Merge…</button>
            <button className="btn ghost" onClick={() => act({ action: 'hide' }, 'Hidden from the dropdown')}>Hide</button>
          </div>
        )}
        {mode === 'rename' && (
          <div className="row"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={140} aria-label="New name" /><button className="btn primary" onClick={() => act({ action: 'rename', name }, 'Renamed')}>Save</button><button className="link small" onClick={() => setMode('')}>cancel</button></div>
        )}
        {mode === 'merge' && (
          <div>
            <div className="row"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the college to merge into" aria-label="Merge into" /><button className="link small" onClick={() => setMode('')}>cancel</button></div>
            <ul className="plain">{matches.slice(0, 6).map((m) => <li key={m._id}><button className="link" onClick={() => act({ action: 'merge', into: m._id }, `Merged into ${m.name}`)}>→ {m.name}</button></li>)}</ul>
          </div>
        )}
      </td>
    </tr>
  );
}

export default function AdminReview() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const toast = useToast();
  const load = useCallback(() => api.adminReview().then(setD).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  if (err) return <p className="error">{err}</p>;
  if (!d) return <p className="muted">Loading the review queue…</p>;
  const doReport = async (id, action) => { try { await api.reviewReport(id, action); toast(action === 'resolve' ? 'Marked fixed' : 'Dismissed', 'good'); load(); } catch (e) { toast(e.message, 'err'); } };
  const okListing = async (id) => { try { await api.reviewListingOk(id); toast('Left as is', 'good'); load(); } catch (e) { toast(e.message, 'err'); } };
  const empty = !d.counts.reports && !d.counts.listings && !d.counts.colleges;

  return (
    <div className="review">
      <p className="small muted">New items here are also emailed to the admin addresses in ADMIN_EMAILS (one listing digest a day; reports and new colleges as they happen).</p>
      {empty && <div className="empty"><h2>All clear ✨</h2><p>Nothing needs a decision right now.</p></div>}

      {d.reports.length > 0 && (
        <section className="an-card">
          <h3>Reports from users ({d.counts.reports})</h3>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Listing</th><th>Problem</th><th>From</th><th /></tr></thead>
            <tbody>{d.reports.map((r) => (
              <tr key={r.id}>
                <td>{r.listing ? <><Link to={`/listing/${r.listing.id}`}>{r.listing.title}</Link><br /><a className="small" href={r.listing.url} target="_blank" rel="noreferrer noopener">organiser page ↗</a></> : '(deleted)'}</td>
                <td><span className="pill warm">{REASON[r.reason] || r.reason}</span>{r.note && <p className="small">{r.note}</p>}</td>
                <td className="small">{r.by?.name}<br /><span className="muted">{r.by?.email}</span></td>
                <td><div className="row"><button className="btn ghost" onClick={() => doReport(r.id, 'resolve')}>Fixed</button><button className="btn ghost" onClick={() => doReport(r.id, 'dismiss')}>Dismiss</button></div></td>
              </tr>
            ))}</tbody>
          </table></div>
          <p className="small muted">To fix a listing, unpublish it in the listings tab or ask the organiser; ingested listings refresh from their source every hour.</p>
        </section>
      )}

      {d.listings.length > 0 && (
        <section className="an-card">
          <h3>Listings that may confuse people ({d.counts.listings})</h3>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Listing</th><th>What looks off</th><th /></tr></thead>
            <tbody>{d.listings.map((l) => (
              <tr key={l.id}>
                <td><Link to={`/listing/${l.id}`}>{l.title}</Link><br /><span className="small muted">{l.platform} · closes {new Date(l.deadline).toLocaleDateString('en-IN')}</span></td>
                <td>{l.issues.map((i) => <span key={i.code} className={`pill ${SEV[i.severity]}`} title={i.code}>{i.note}</span>)}</td>
                <td><div className="row"><a className="btn ghost" href={l.url} target="_blank" rel="noreferrer noopener">Check ↗</a><button className="btn ghost" onClick={() => okListing(l.id)}>Looks fine</button></div></td>
              </tr>
            ))}</tbody>
          </table></div>
        </section>
      )}

      {d.colleges.length > 0 && (
        <section className="an-card">
          <h3>Colleges added by users ({d.counts.colleges})</h3>
          <p className="small muted">Already visible in the dropdown. Approve, fix the spelling, merge duplicates into the official name, or hide junk.</p>
          <div className="tbl-wrap"><table className="tbl"><tbody>{d.colleges.map((c) => <CollegeRow key={c.id} c={c} onDone={load} />)}</tbody></table></div>
        </section>
      )}
    </div>
  );
}

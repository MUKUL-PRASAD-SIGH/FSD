import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Empty, closes } from '../components.jsx';

const STAGES = ['saved', 'applied', 'shortlisted', 'won', 'rejected'];

export default function Tracker() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { if (user) api.saved().then((r) => setRows(r.saved)).catch((e) => setError(e.message)); }, [user]);

  if (error) return <p className="error">{error}</p>;
  if (!rows) return <p className="muted">Loading…</p>;

  async function move(row, status) {
    setRows(rows.map((r) => (r.id === row.id ? { ...r, status } : r)));
    try { await api.saveListing(row.listing.id, { status }); } catch (e) { setError(e.message); }
  }
  async function remove(row) {
    setRows(rows.filter((r) => r.id !== row.id));
    try { await api.unsave(row.listing.id); } catch (e) { setError(e.message); }
  }
  const icsIds = rows.filter((r) => r.status === 'saved' || r.status === 'applied').map((r) => r.listing.id).join(',');

  return (
    <>
      <div className="row-between">
        <h1>Tracker</h1>
        {icsIds && <a className="btn ghost" href={`/api/listings/calendar.ics?ids=${icsIds}`}>Add deadlines to calendar</a>}
      </div>
      {!rows.length && <Empty>Nothing saved yet. Hit “Save” on any listing to track it here.</Empty>}
      <div className="board">
        {STAGES.map((s) => (
          <section key={s} className="col">
            <h2>{s} <span className="muted">{rows.filter((r) => r.status === s).length}</span></h2>
            {rows.filter((r) => r.status === s).map((r) => (
              <div className="mini" key={r.id}>
                <a href={r.listing.url} target="_blank" rel="noreferrer">{r.listing.title}</a>
                <span className="muted small">{closes(r.listing.deadline).text} · {r.listing.platform}</span>
                <div className="mini-actions">
                  <select value={r.status} onChange={(e) => move(r, e.target.value)} aria-label="Move to stage">
                    {STAGES.map((x) => <option key={x}>{x}</option>)}
                  </select>
                  <button className="link" onClick={() => remove(r)}>remove</button>
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}

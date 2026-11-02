import { useState } from 'react';
import { api } from '../api.js';
import { ListingCard, Empty } from '../components.jsx';

const EXAMPLES = ['Case competitions for engineering students', 'Online AI hackathons closing soon', 'Free contests with 1L+ prizes', 'In person web hackathons'];

export default function Ask() {
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function go(question) {
    if (question.trim().length < 3) return;
    setBusy(true); setError('');
    try { setRes(await api.ask(question)); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <>
      <h1>Ask</h1>
      <p className="muted">Describe who you are and what you want. We read the filters out of your sentence and rank the matches. {res?.personalised === false && 'Sign in to also factor in your resume.'}</p>
      <form className="ask" onSubmit={(e) => { e.preventDefault(); go(q); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. online ML hackathons closing soon with 1L+ prize" aria-label="Your question" />
        <button className="btn primary" disabled={busy}>{busy ? 'Searching…' : 'Ask'}</button>
      </form>
      <div className="chips">
        {EXAMPLES.map((x) => <button key={x} className="chip" onClick={() => { setQ(x); go(x); }}>{x}</button>)}
      </div>
      {error && <p className="error">{error}</p>}
      {res && (
        <>
          <p className="muted small">
            {res.understood.length ? <>Understood: {res.understood.join(' · ')}. </> : 'No specific filters recognised, ranking by relevance. '}
            {res.total} open listing{res.total === 1 ? '' : 's'} matched the filters.
          </p>
          <div className="grid">{res.results.map((r) => <ListingCard key={r.listing.id} item={r.listing} rec={r} />)}</div>
          {!res.results.length && <Empty>No open listings fit that. Try fewer constraints.</Empty>}
        </>
      )}
    </>
  );
}

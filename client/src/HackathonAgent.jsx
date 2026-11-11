import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from './api.js';
import { useAuth } from './auth.jsx';

const SUGGESTIONS = ['Who can participate?', 'What are the prizes?', 'What is the deadline and how do I register?', 'What is the team size?', 'Is it online or in person?'];

const ago = (d) => {
  const m = Math.round((Date.now() - new Date(d)) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

// Per-event agent: crawls THIS event's own site (politely, robots-aware) and answers only from it.
// Your questions are saved privately to you; the bare question may be counted anonymously (opt-out below).
export default function HackathonAgent({ listing }) {
  const { user, setUser } = useAuth();
  const [msgs, setMsgs] = useState([]);
  const [popular, setPopular] = useState([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef(null);
  const share = user?.privacy?.shareQuestions !== false;

  useEffect(() => {
    setMsgs([]); setQ(''); setPopular([]);
    if (!user) return undefined;
    let live = true;
    api.listingHistory(listing.id).then((r) => { if (live) setMsgs(r.items.flatMap((i) => [{ role: 'user', text: i.question }, { role: 'assistant', text: i.answer, restored: true }])); }).catch(() => {});
    api.listingQuestions(listing.id).then((r) => { if (live) setPopular(r.popular); }).catch(() => {});
    return () => { live = false; };
  }, [listing.id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (msgs.length) end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [msgs, busy]);

  async function ask(text) {
    const question = (text ?? q).trim();
    if (question.length < 3 || busy) return;
    const history = msgs.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text }));
    setMsgs((l) => [...l, { role: 'user', text: question }]); setQ(''); setBusy(true);
    try {
      const r = await api.askListing(listing.id, question, history);
      setMsgs((l) => [...l, { role: 'assistant', text: r.answer, sources: r.sources, page: r.page, note: r.note }]);
    } catch (e) { setMsgs((l) => [...l, { role: 'assistant', text: e.message, error: true }]); } finally { setBusy(false); }
  }
  async function clearHistory() { await api.clearListingHistory(listing.id); setMsgs([]); }
  async function toggleShare(on) { try { const r = await api.updateProfile({ privacy: { shareQuestions: on } }); setUser(r.user); } catch { /* keep current */ } }

  if (!user) {
    return (
      <section className="panel agent" aria-label="Ask about this hackathon">
        <h2>Ask about this hackathon <span className="pill">AI</span></h2>
        <p className="muted">Our agent reads this event’s own website (rules, FAQ, schedule, prizes) and answers your questions about it. <Link to="/login" state={{ from: `/listing/${listing.id}` }}>Sign in</Link> to try it.</p>
      </section>
    );
  }
  const last = [...msgs].reverse().find((m) => m.page);
  const chips = [...popular.map((p) => ({ text: p.text, count: p.count })), ...SUGGESTIONS.map((t) => ({ text: t }))].slice(0, 8);
  return (
    <section className="panel agent" aria-label="Ask about this hackathon">
      <div className="studio-head">
        <h2>Ask about this hackathon <span className="pill">AI</span></h2>
        {msgs.length > 0 && <button className="link small" onClick={clearHistory}>Clear my history</button>}
      </div>
      <p className="muted small">Reads this event’s own site{listing.platform ? ` (via ${listing.platform})` : ''} when you ask, and answers only from it. It can’t see other events.</p>
      {!msgs.length && (
        <>
          {popular.length > 0 && <p className="small muted">Most asked about this event:</p>}
          <div className="chips">{chips.map((c) => <button key={c.text} type="button" className="chip" onClick={() => ask(c.text)} disabled={busy}>{c.text}{c.count ? ` · ${c.count}` : ''}</button>)}</div>
        </>
      )}
      <div className="chat" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={`bubble ${m.role} ${m.error ? 'error' : ''}`}>
            <p>{m.text}</p>
            {m.note && <p className="small muted">ⓘ {m.note}</p>}
            {m.sources?.length > 0 && (
              <details className="small">
                <summary>Sources ({m.sources.length})</summary>
                <ol className="cites">
                  {m.sources.map((s) => (
                    <li key={s.n}><b>{s.from === 'faq' ? 'FAQ' : s.from === 'page' ? 'Event site' : 'Listing data'}</b>{s.heading && s.from === 'page' ? ` · ${s.heading}` : ''}: “{s.snippet}”{s.url && <> <a href={s.url} target="_blank" rel="noreferrer noopener">open ↗</a></>}</li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        ))}
        {busy && <div className="bubble"><p className="muted">Reading the event’s site…</p></div>}
        <span ref={end} />
      </div>
      <form className="ask" onSubmit={(e) => { e.preventDefault(); ask(); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Can first-year students join?" maxLength={400} aria-label="Question about this hackathon" disabled={busy} />
        <button className="btn primary" disabled={busy || q.trim().length < 3}>Ask</button>
      </form>
      {last && (
        <p className="small muted">
          {last.page.ok ? <>Read live from <a href={last.page.url} target="_blank" rel="noreferrer noopener">{last.page.host}</a> ({last.page.pagesRead} page{last.page.pagesRead === 1 ? '' : 's'}{last.page.faqFound ? `, ${last.page.faqFound} FAQ entries` : ''}) · {ago(last.page.fetchedAt)}.</> : <>Couldn’t read <a href={last.page.url} target="_blank" rel="noreferrer noopener">{last.page.host}</a>; answers use the listing data.</>} Always confirm key details with the organiser.
        </p>
      )}
      <label className="chk small private-note">
        <input type="checkbox" checked={share} onChange={(e) => toggleShare(e.target.checked)} />
        Count my questions anonymously to show what people ask about events (no name, email or account is attached; questions containing personal details are never shared). Your own history above is visible only to you.
      </label>
    </section>
  );
}

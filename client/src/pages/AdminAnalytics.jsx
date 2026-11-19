import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

// Admin-only screens (the /admin route is guarded, and every endpoint behind them is admin-only on the server).
const n = (x) => Number(x || 0).toLocaleString('en-IN');
const ago = (d) => { if (!d) return '—'; const m = Math.round((Date.now() - new Date(d)) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };

function Kpi({ label, value, sub }) {
  return <div className="kpi"><dt>{label}</dt><dd>{value}</dd>{sub && <span className="small muted">{sub}</span>}</div>;
}

// Vertical bars for a per-day series. Each bar carries a native tooltip with the exact value.
function DayBars({ rows, field, label }) {
  const max = Math.max(1, ...rows.map((r) => r[field]));
  const w = 100 / Math.max(1, rows.length);
  return (
    <figure className="daybars">
      <figcaption className="small muted">{label} · peak {n(max)}</figcaption>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label={`${label} per day`}>
        {rows.map((r, i) => {
          const h = (r[field] / max) * 38;
          return <rect key={r.day} x={i * w + w * 0.15} y={40 - h} width={w * 0.7} height={Math.max(h, r[field] ? 0.8 : 0)} rx="0.6"><title>{`${r.day}: ${n(r[field])}`}</title></rect>;
        })}
      </svg>
      <div className="daybars-axis small muted"><span>{rows[0]?.day.slice(5)}</span><span>{rows[rows.length - 1]?.day.slice(5)}</span></div>
    </figure>
  );
}

// Horizontal ranked bars
function Ranked({ title, rows, value, label, empty = 'No data yet.' }) {
  const max = Math.max(1, ...rows.map(value));
  return (
    <section className="an-card">
      <h3>{title}</h3>
      {!rows.length ? <p className="small muted">{empty}</p> : (
        <ol className="hbars">
          {rows.map((r, i) => (
            <li key={i}>
              <div className="hbar-label">{label(r)}</div>
              <div className="hbar-track"><span style={{ width: `${(value(r) / max) * 100}%` }} /></div>
              <div className="hbar-val mono small">{n(value(r))}</div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

const pairs = (rows, key = 'count') => rows.map((r) => ({ label: String(r.value), v: r[key] }));

export function Analytics() {
  const [days, setDays] = useState(30);
  const [d, setD] = useState(null);
  const [b, setB] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    setErr('');
    api.adminAnalytics(days).then(setD).catch((e) => setErr(e.message));
    api.adminBreakdowns(days).then(setB).catch(() => {});
  }, [days]);
  if (err) return <p className="error">{err}</p>;
  if (!d) return <p className="muted">Loading analytics…</p>;
  const o = d.overview;
  const listingLabel = (l) => <Link to={`/listing/${l.id}`} title={`${l.platform || l.source} · ${l.type || ''}`}>{l.title}</Link>;
  return (
    <div className="analytics">
      <div className="row-between">
        <p className="small muted">Counted from in-app activity. Users who turned off usage analytics are only in anonymous totals.</p>
        <div className="seg">{[7, 30, 90].map((x) => <button key={x} className={days === x ? 'on' : ''} onClick={() => setDays(x)}>{x} days</button>)}</div>
      </div>

      <dl className="kpis">
        <Kpi label="users" value={n(o.users.total)} sub={`${n(o.users.newInWindow)} new · ${n(o.users.pro)} Pro`} />
        <Kpi label="active users" value={n(o.users.activeInWindow)} sub={`${n(o.users.activeToday)} today`} />
        <Kpi label="time on platform" value={`${n(Math.round(o.time.totalMinutes))} min`} sub={`${o.time.avgMinutesPerActiveUser} min per active user`} />
        <Kpi label="listing views" value={n(o.events.listingViews)} sub={`${n(o.events.pageViews)} page views`} />
        <Kpi label="register clicks" value={n(o.events.registerClicks)} sub={`${d.funnel.viewToClickPct}% of viewers`} />
        <Kpi label="saves to tracker" value={n(o.engagement.savesToTracker)} sub={`${n(o.events.searches)} searches`} />
        <Kpi label="chat messages" value={n(o.engagement.chatMessages)} sub={`${n(o.engagement.teamsCreated)} teams created`} />
        <Kpi label="open listings" value={n(o.openListings)} />
      </dl>

      <div className="an-grid two">
        <section className="an-card"><h3>Active users per day</h3><DayBars rows={d.series} field="activeUsers" label="active users" /></section>
        <section className="an-card"><h3>Listing views per day</h3><DayBars rows={d.series} field="listingViews" label="listing views" /></section>
        <section className="an-card"><h3>Minutes on platform per day</h3><DayBars rows={d.series} field="minutes" label="minutes" /></section>
        <section className="an-card"><h3>Signups per day</h3><DayBars rows={d.series} field="signups" label="signups" /></section>
      </div>

      <section className="an-card">
        <h3>Who spends the most time</h3>
        {!d.timeSpent.length ? <p className="small muted">No time recorded yet. Time is counted while a signed-in user has the app open in a visible tab.</p> : (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>User</th><th>Role</th><th>Minutes</th><th>Active days</th><th>Per day</th><th>Last seen</th></tr></thead>
            <tbody>{d.timeSpent.map((u) => <tr key={u.id}><td>{u.name}<br /><span className="small muted">{u.email}</span></td><td>{u.role} · {u.plan}</td><td className="mono">{u.minutes}</td><td className="mono">{u.activeDays}</td><td className="mono">{u.avgMinutesPerDay}</td><td className="small">{ago(u.lastSeenAt)}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>

      <div className="an-grid three">
        <Ranked title="Most viewed hackathons" rows={d.mostViewed} value={(l) => l.count} label={listingLabel} />
        <Ranked title="Most Register clicks" rows={d.mostClicked} value={(l) => l.count} label={listingLabel} />
        <Ranked title="Most saved to trackers" rows={d.mostSaved} value={(l) => l.count} label={listingLabel} />
        <Ranked title="Top searches" rows={d.searches} value={(s) => s.count} label={(s) => `“${s.query}”`} />
        <Ranked title="Most visited pages" rows={d.pages} value={(p) => p.views} label={(p) => <span className="mono small">{p.path}</span>} />
        <section className="an-card">
          <h3>Funnel</h3>
          <ol className="funnel">
            <li><strong>{n(d.funnel.viewers)}</strong> viewed a listing</li>
            <li><strong>{n(d.funnel.clickers)}</strong> clicked Register <span className="muted">({d.funnel.viewToClickPct}%)</span></li>
            <li><strong>{n(d.funnel.savers)}</strong> saved one <span className="muted">({d.funnel.viewToSavePct}%)</span></li>
          </ol>
          <p className="small muted">Signed-in people. Plus {n(d.funnel.anonymousListingViews)} anonymous listing views.</p>
        </section>
      </div>

      {b && (
        <div className="an-grid three">
          <Ranked title="Views by listing type" rows={pairs(b.listings.views.byType, 'views')} value={(r) => r.v} label={(r) => r.label} />
          <Ranked title="Views by source" rows={pairs(b.listings.views.bySource, 'views')} value={(r) => r.v} label={(r) => r.label} />
          <Ranked title="Views by mode" rows={pairs(b.listings.views.byMode, 'views')} value={(r) => r.v} label={(r) => r.label} />
          <Ranked title="Top colleges" rows={pairs(b.users.colleges)} value={(r) => r.v} label={(r) => r.label} />
          <Ranked title="Top cities" rows={pairs(b.users.cities)} value={(r) => r.v} label={(r) => r.label} />
          <Ranked title="Top skills" rows={pairs(b.users.skills)} value={(r) => r.v} label={(r) => r.label} />
          <Ranked title="Users by plan" rows={pairs(b.users.plans)} value={(r) => r.v} label={(r) => r.label} />
          <Ranked title="Open listings by type" rows={pairs(b.listings.openListings.byType)} value={(r) => r.v} label={(r) => r.label} />
          <section className="an-card">
            <h3>Chat</h3>
            <p><strong>{n(b.chat.messagesPerDay.reduce((s, x) => s + x.messages, 0))}</strong> messages from <strong>{n(b.chat.activeSenders)}</strong> people in <strong>{n(b.chat.activeRooms)}</strong> rooms</p>
            <p className="small muted">{Object.entries(b.chat.roomsByKind).map(([k, v]) => `${v} ${k}`).join(' · ') || 'No rooms yet'}. {b.chat.note}</p>
          </section>
        </div>
      )}
    </div>
  );
}

const SUGGEST = [
  'Give me an overview of the platform this week',
  'Which hackathons are the most viewed in the last 30 days?',
  'Who is spending the most time on the platform?',
  'What do people search for most?',
  'How is the view to register funnel doing?',
  'Which colleges and skills do our users have?',
];

export function AdminAI() {
  const [msgs, setMsgs] = useState([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [msgs, busy]);

  async function ask(text) {
    const question = (text ?? q).trim();
    if (question.length < 3 || busy) return;
    setBusy(true); setErr(''); setQ('');
    const history = msgs.slice(-6).map((m) => ({ role: m.role, text: m.text }));
    setMsgs((l) => [...l, { role: 'user', text: question }]);
    try {
      const r = await api.adminAssistant(question, history);
      setMsgs((l) => [...l, { role: 'assistant', text: r.answer, tools: r.tools, mode: r.mode }]);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="admin-ai">
      <p className="small muted">Ask about users, engagement and listings. Answers come only from fixed, read-only analytics queries; this assistant cannot see passwords, tokens, resumes, message text or anyone&apos;s private AI chats. Every question is recorded in the audit log.</p>
      {!msgs.length && <div className="chips">{SUGGEST.map((s) => <button key={s} className="chip" onClick={() => ask(s)}>{s}</button>)}</div>}
      <div className="chat ai-thread" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            <p>{m.text}</p>
            {m.tools && <p className="small muted">Data: {m.tools.map((t) => `${t.tool}${t.args?.metric ? ` (${t.args.metric})` : ''}${t.args?.days ? ` · ${t.args.days}d` : ''}`).join(', ')} · {m.mode === 'gemini' ? 'written by Gemini from that data' : 'templated answer'}</p>}
          </div>
        ))}
        {busy && <p className="small muted">Looking at the data…</p>}
        <div ref={end} />
      </div>
      {err && <p className="error small" role="alert">{err}</p>}
      <form className="composer" onSubmit={(e) => { e.preventDefault(); ask(); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={500} placeholder="e.g. how much time has Priya spent this week?" aria-label="Ask the admin assistant" />
        <button className="btn primary" disabled={busy || q.trim().length < 3}>Ask</button>
      </form>
    </div>
  );
}

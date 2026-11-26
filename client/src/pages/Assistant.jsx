import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Emblem } from '../ui.jsx';
import { ProGate } from '../premium/Plan.jsx';
import './assistant.css';

const Icon = ({ d, fill }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const ICONS = {
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 20h8M10 17h4',
  star: 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z',
  calendar: 'M5 5h14v15H5zM5 10h14M9 3v4M15 3v4M9 14h2',
  people: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20c0-3 2.5-5 6-5s6 2 6 5M16 11a2.5 2.5 0 1 0 0-5M17 15c2.4.3 4 2 4 5',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM16.5 16.5 21 21',
  send: 'M21 3 10 14M21 3l-7 18-4-7-7-4 18-7Z',
  plus: 'M12 5v14M5 12h14',
  chat: 'M4 5h16v11H9l-5 4V5Z',
};

// Quick-start cards and slash commands share the same sentences, so both routes lead to the same grounded question.
const AGENTS = [
  ['trophy', 'Best-fit events', 'Rank what matches my resume, location and skills.', 'Which hackathons near me fit my resume best this month?'],
  ['star', 'Big prizes, online', 'Online AI competitions with serious prize pools.', 'Online AI competitions with big prizes closing this month'],
  ['calendar', 'Deadline radar', 'What closes soon that I can still finish?', 'What closes this week that I can still finish?'],
  ['people', 'Skill gap check', 'Which skills would unlock more events for me?', 'What should I add to my skills to qualify for more events?'],
];
const COMMANDS = [
  ['/fit', 'Best-fit events for my profile', AGENTS[0][3]],
  ['/prizes', 'Online competitions with big prizes', AGENTS[1][3]],
  ['/deadlines', 'What closes this week', AGENTS[2][3]],
  ['/gaps', 'Skills I should add', AGENTS[3][3]],
  ['/teams', 'Hackathons worth finding teammates for', 'Which upcoming hackathons should I find teammates for?'],
];
const STEPS = ['Searching live listings', 'Ranking against your profile', 'Writing a grounded answer'];

// Minimal, safe markdown for model answers: **bold**, "* " / "- " bullets (nested by indent), paragraphs. Builds React nodes only.
function inline(text) {
  return String(text).split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : part));
}
function Rich({ text }) {
  const out = [];
  let list = null;
  String(text).split('\n').forEach((line, i) => {
    const m = line.match(/^(\s*)[*-]\s+(.*)$/);
    if (m) {
      if (!list) { list = []; out.push({ list, key: i }); }
      list.push({ depth: Math.min(2, Math.floor(m[1].length / 2)), text: m[2], key: i });
    } else {
      list = null;
      if (line.trim()) out.push({ p: line, key: i });
    }
  });
  return out.map((b, n) => (b.list
    ? <ul className="aw-list" key={b.key} style={{ '--i': n }}>{b.list.map((li) => <li key={li.key} style={{ marginLeft: li.depth * 18 }}>{inline(li.text)}</li>)}</ul>
    : <p key={b.key} style={{ '--i': n }}>{inline(b.p)}</p>));
}

// Cycles through what the assistant is doing while the request is in flight.
function Thinking() {
  const [s, setS] = useState(0);
  useEffect(() => { const t = setInterval(() => setS((n) => Math.min(n + 1, STEPS.length - 1)), 1400); return () => clearInterval(t); }, []);
  return (
    <div className="aw-think" role="status" aria-live="polite">
      <span className="aw-orbdot" aria-hidden="true"><i /><i /><i /></span>
      <div><b>{STEPS[s]}…</b><span className="aw-steps">{STEPS.map((x, n) => <i key={x} className={n <= s ? 'on' : ''} />)}</span></div>
    </div>
  );
}

function Chat() {
  const [convs, setConvs] = useState([{ id: 1, title: 'New chat', msgs: [] }]);
  const [active, setActive] = useState(1);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');
  const [stats, setStats] = useState(null);
  const end = useRef(null);
  const input = useRef(null);
  const conv = convs.find((c) => c.id === active) || convs[0];
  const msgs = conv.msgs;
  const started = msgs.length > 0;
  const slash = q.startsWith('/') ? COMMANDS.filter(([c]) => c.startsWith(q.split(' ')[0].toLowerCase())) : [];

  useEffect(() => { api.stats().then(setStats).catch(() => {}); }, []);

  const patch = (id, fn) => setConvs((cs) => cs.map((c) => (c.id === id ? fn(c) : c)));
  function newChat() {
    if (busy) return;
    const fresh = convs.find((c) => !c.msgs.length);
    if (fresh) { setActive(fresh.id); } else { const id = Date.now(); setConvs((cs) => [{ id, title: 'New chat', msgs: [] }, ...cs]); setActive(id); }
    setQ(''); setTimeout(() => input.current?.focus(), 50);
  }

  async function send(text) {
    const question = text.trim();
    if (question.length < 3 || busy) return;
    const id = conv.id;
    const history = conv.msgs.map((m) => ({ role: m.role, text: m.text }));
    setQ(''); setBusy(true);
    patch(id, (c) => ({ ...c, title: c.msgs.length ? c.title : question.slice(0, 48), msgs: [...c.msgs, { role: 'user', text: question }] }));
    try {
      const r = await api.chat(question, history);
      patch(id, (c) => ({ ...c, msgs: [...c.msgs, { role: 'assistant', text: r.answer, citations: r.citations, mode: r.mode, usedResume: r.usedResume }] }));
    } catch (e) { patch(id, (c) => ({ ...c, msgs: [...c.msgs, { role: 'assistant', text: e.message, error: true }] })); }
    finally { setBusy(false); setTimeout(() => end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60); }
  }

  const shown = useMemo(() => convs.filter((c) => c.msgs.length && c.title.toLowerCase().includes(filter.toLowerCase())), [convs, filter]);
  const onKey = (e) => { if (e.key === 'Tab' && slash.length && q.split(' ').length === 1) { e.preventDefault(); setQ(slash[0][2]); } };

  return (
    <div className="aw">
      <aside className="aw-side" aria-label="Sessions">
        <button className="btn primary aw-new" onClick={newChat} disabled={busy}><Icon d={ICONS.plus} /> New chat</button>
        <label className="aw-find"><Icon d={ICONS.search} /><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search chats" aria-label="Search chats" /></label>
        <p className="aw-side-h">This session</p>
        <ul className="aw-sessions">
          {shown.map((c) => (
            <li key={c.id}><button className={c.id === active ? 'on' : ''} onClick={() => !busy && setActive(c.id)} aria-current={c.id === active}><Icon d={ICONS.chat} /><span><b>{c.title}</b><small>{c.msgs.filter((m) => m.role === 'user').length} question{c.msgs.filter((m) => m.role === 'user').length === 1 ? '' : 's'}</small></span></button></li>
          ))}
          {!shown.length && <li className="aw-none">{filter ? 'No chats match.' : 'Your questions appear here. Chats are kept until you close the tab.'}</li>}
        </ul>
        <div className="aw-side-foot"><span className="aw-pulse" /> Grounded in live listings{stats ? ` · ${stats.open.toLocaleString('en-IN')} open` : ''}</div>
      </aside>

      <section className="aw-main">
        {!started ? (
          <div className="aw-hero">
            <Emblem size={170} parallax />
            <h1>I’m your AI assistant.<br /><span>How can I help today?</span></h1>
            <p>Answers are grounded in live listings plus your resume and location, with sources you can open.</p>
          </div>
        ) : (
          <header className="aw-head"><span className="aw-mini"><Emblem size={46} /></span><div><b>{conv.title}</b><small>HackElite Assistant</small></div><button className="btn ghost aw-new-m" onClick={newChat}><Icon d={ICONS.plus} /> New</button></header>
        )}

        {started ? (
          <div className="aw-convo" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={`aw-msg ${m.role} ${m.error ? 'error' : ''}`}>
                {m.role === 'assistant' && !m.error ? <div className="aw-body"><Rich text={m.text} /></div> : <p>{m.text}</p>}
                {m.citations?.length > 0 && (
                  <details className="aw-src" open={i === msgs.length - 1}>
                    <summary>Sources <span>{m.citations.length}</span></summary>
                    <ol>{m.citations.map((c, n) => <li key={c.id} style={{ '--i': n }}><a href={c.url} target="_blank" rel="noreferrer">{c.title}</a><em>{c.score}%</em></li>)}</ol>
                  </details>
                )}
                {m.mode && <p className="aw-note">{m.mode === 'refused' ? 'Blocked by the privacy guardrail' : m.mode === 'gemini' ? 'Generated by Gemini from retrieved listings' : 'Built from your top retrieved matches'}{m.usedResume ? ' · used your resume' : ''}</p>}
              </div>
            ))}
            {busy && <Thinking />}
            <div ref={end} />
          </div>
        ) : (
          <div className="aw-agents">
            <h2>Ask me to…</h2>
            <div className="aw-cards">
              {AGENTS.map(([icon, title, desc, ask], n) => (
                <button type="button" key={title} style={{ '--n': n }} onClick={() => send(ask)} disabled={busy}>
                  <span className="aw-ico"><Icon d={ICONS[icon]} /></span><span><b>{title}</b><small>{desc}</small></span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="aw-dock">
          {slash.length > 0 && (
            <ul className="aw-slash" role="listbox" aria-label="Commands">
              {slash.map(([c, label, full]) => <li key={c}><button type="button" role="option" aria-selected="false" onClick={() => { setQ(full); input.current?.focus(); }}><b>{c}</b><span>{label}</span></button></li>)}
            </ul>
          )}
          <form className="aw-bar" onSubmit={(e) => { e.preventDefault(); send(q); }}>
            <label className="visually-hidden" htmlFor="aw-in">Your question</label>
            <input id="aw-in" ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} maxLength={500} placeholder="Ask about events, deadlines, fit…  Type / for commands" autoComplete="off" />
            <button className="btn primary" disabled={busy || q.trim().length < 3}><Icon d={ICONS.send} /><span>Send</span></button>
          </form>
          <p className="aw-hint">Press <kbd>/</kbd> for commands · <Link to="/browse">browse the feed</Link> · answers can contain mistakes, check the listing.</p>
        </div>
      </section>
    </div>
  );
}

export default function Assistant() { return <ProGate what="The assistant"><Chat /></ProGate>; }

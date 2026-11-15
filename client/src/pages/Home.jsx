import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { closes, prizeText } from '../components.jsx';
import { Avatar, CountUp, Emblem, Reveal, Ring, reducedMotion, useInView } from '../ui.jsx';
import './landing.css';

const TABS = [['HACKATHON', 'Hackathons'], ['CODING', 'Coding'], ['DESIGN', 'Design'], ['CASE STUDY', 'Case studies']];
const HEADLINE = ['Your', 'next', 'big', 'idea', 'deserves', 'a'];
const Arrow = () => <svg aria-hidden="true" viewBox="0 0 20 20" className="ld-arrow"><path d="M4 10h11M10 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;

// Interactive showcase: pick a category, real listings rotate in a glass "device" card (pauses on hover/focus).
function Showcase() {
  const [tab, setTab] = useState(TABS[0][0]);
  const [items, setItems] = useState([]);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => { let live = true; setI(0); api.listings({ type: tab, limit: 4, sort: 'deadline' }).then((r) => live && setItems(r.listings)).catch(() => live && setItems([])); return () => { live = false; }; }, [tab]);
  useEffect(() => {
    if (paused || items.length < 2 || reducedMotion()) return undefined;
    const t = setInterval(() => setI((n) => (n + 1) % items.length), 5200);
    return () => clearInterval(t);
  }, [paused, items.length]);
  const cur = items[i];
  const prize = cur && prizeText(cur.prize);
  const c = cur && closes(cur.deadline);
  return (
    <Reveal className="ld-show" aria-label="Opportunity showcase">
      <div className="ld-tabs" role="tablist" aria-label="Opportunity type">
        {TABS.map(([v, l]) => <button key={v} role="tab" aria-selected={tab === v} className={tab === v ? 'on' : ''} onClick={() => setTab(v)}>{l}</button>)}
      </div>
      <div className="ld-stage" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
        {cur ? (
          <Link key={cur.id} to={`/listing/${cur.id}`} className="ld-device">
            <span className="ld-device-top"><span className="ld-live"><i /> {cur.mode?.toLowerCase()}</span><span className={`ld-due ${c.tone}`}>◷ {c.text}</span></span>
            <h3>{cur.title}</h3>
            <p>{cur.organiser || 'Open to builders everywhere'} · {cur.platform}</p>
            <span className="ld-device-bottom">
              <span className="ld-prize"><small>prize</small><b>{prize ? prize.text : 'See listing'}</b></span>
              <span className="ld-fee"><small>entry</small><b>{/free/i.test(cur.fee) ? 'Free' : cur.fee}</b></span>
              <span className="ld-go">View <Arrow /></span>
            </span>
          </Link>
        ) : <div className="ld-device ld-device-empty">Loading live listings…</div>}
        <div className="ld-dots" role="group" aria-label="Choose listing">{items.map((x, n) => <button key={x.id} className={n === i ? 'on' : ''} aria-label={`Show ${x.title}`} aria-pressed={n === i} onClick={() => setI(n)} />)}</div>
      </div>
    </Reveal>
  );
}

function Step({ n, title, text, to, label }) {
  const [ref, seen] = useInView('0px 0px -25% 0px');
  return (
    <div ref={ref} className={`ld-step ${seen ? 'lit' : ''}`}>
      <span className="ld-step-n">{n}</span>
      <div><h3>{title}</h3><p>{text}</p><Link to={to} className="ld-link">{label} <Arrow /></Link></div>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [stats, setStats] = useState(null);
  const [q, setQ] = useState('');
  const heroRef = useRef(null);
  useEffect(() => { api.stats().then(setStats).catch(() => {}); }, []);
  const platforms = stats?.platforms?.map((p) => p.name) || [];
  const go = (e) => { e.preventDefault(); nav(`/browse${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`); };

  return (
    <div className="ld">
      <section className="ld-hero" ref={heroRef} aria-labelledby="ld-title">
        <div className="ld-hero-copy">
          <p className="ld-kicker"><span className="ld-pulse" /> The opportunity hub for builders</p>
          <h1 id="ld-title">
            {HEADLINE.map((w, n) => <span key={w} className="ld-word" style={{ '--i': n }}>{w}&nbsp;</span>)}
            <span className="ld-word ld-hl" style={{ '--i': HEADLINE.length }}>big stage.</span>
          </h1>
          <p className="ld-lede">Hackathons, case competitions and contests from every platform, de-duplicated into one feed. Get matched to the ones that fit you, then never miss a deadline.</p>
          <form className="ld-search" role="search" onSubmit={go}>
            <label className="visually-hidden" htmlFor="ld-q">Search opportunities</label>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
            <input id="ld-q" type="search" placeholder="Try AI, climate, design…" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn primary">Explore <Arrow /></button>
          </form>
          <div className="ld-cta-row">
            <Link className="ld-link" to={user ? '/for-you' : '/register'}>{user ? 'See your personal matches' : 'Create a free account'} <Arrow /></Link>
            <a className="ld-link soft" href="#ld-how">See how it works ↓</a>
          </div>
        </div>
        <div className="ld-hero-art">
          <Emblem size={440} parallax className="ld-emblem" />
          <span className="ld-chip c1"><i className="ld-pulse" /><b><CountUp value={stats?.open} /></b> open now</span>
          <span className="ld-chip c2"><b><CountUp value={stats?.closingWeek} /></b> closing this week</span>
          <span className="ld-chip c3">✦ AI-matched to your resume</span>
        </div>
      </section>

      {platforms.length > 0 && (
        <div className="ld-marquee" aria-label="Sources we aggregate">
          <div className="ld-track">{[...platforms, ...platforms].map((p, n) => <span key={p + n} aria-hidden={n >= platforms.length}>{p}</span>)}</div>
        </div>
      )}

      <section className="ld-sec" aria-labelledby="ld-show-t">
        <Reveal className="ld-head"><p className="ld-kicker">Live from the feed</p><h2 id="ld-show-t">See what is open right now.</h2><p>Real listings, straight from the organisers. Pick a category and watch the feed move.</p></Reveal>
        <Showcase />
      </section>

      <section className="ld-sec" aria-labelledby="ld-bento-t">
        <Reveal className="ld-head"><p className="ld-kicker">Everything in one place</p><h2 id="ld-bento-t">Built to get you from search to submitted.</h2></Reveal>
        <div className="ld-bento">
          <Reveal className="ld-tile t-match" delay={0}>
            <div><h3>Resume-aware matching</h3><p>Upload your resume and every listing gets a 0 to 100 fit score with plain-English reasons.</p></div>
            <div className="ld-match-demo"><Ring value={87} size={96} stroke={8} label="87" sub="match" /><ul><li>matches your React skills</li><li>online, no travel needed</li><li>closes in 9 days</li></ul></div>
          </Reveal>
          <Reveal className="ld-tile t-ask" delay={80}>
            <h3>Ask in plain English</h3>
            <div className="ld-prompt"><span>online AI hackathons with ₹1L+ prizes</span><i /></div>
            <p>We read the filters out of your sentence.</p>
          </Reveal>
          <Reveal className="ld-tile t-feed" delay={120}>
            <h3>One feed, every source</h3>
            <div className="ld-orbs">{(platforms.length ? platforms : ['Devpost', 'Unstop', 'Devfolio']).slice(0, 7).map((p, n) => <span key={p} style={{ '--n': n }}>{p[0]}</span>)}</div>
            <p><CountUp value={stats?.platforms?.length || 16} /> platforms, duplicates merged.</p>
          </Reveal>
          <Reveal className="ld-tile t-track" delay={160}>
            <h3>Application tracker</h3>
            <div className="ld-mini-board">{['saved', 'applied', 'won'].map((c, n) => <div key={c}><small>{c}</small>{Array.from({ length: 3 - n }, (_, k) => <i key={k} style={{ '--k': k }} />)}</div>)}</div>
          </Reveal>
          <Reveal className="ld-tile t-team" delay={200}>
            <h3>Teams and chat</h3>
            <div className="ld-stack">{['Asha Verma', 'Ravi K', 'Mina Das', 'Leo P'].map((n) => <Avatar key={n} name={n} size={42} />)}<span className="ld-plus">+2</span></div>
            <p>Find teammates, invite them, chat live.</p>
          </Reveal>
          <Reveal className="ld-tile t-rem" delay={240}>
            <h3>Deadline reminders</h3>
            <div className="ld-bell"><span>◷</span><b>Closes in 2 days</b><small>We will remind you first.</small></div>
          </Reveal>
        </div>
      </section>

      <section className="ld-sec ld-how" id="ld-how" aria-labelledby="ld-how-t">
        <Reveal className="ld-head"><p className="ld-kicker">How it works</p><h2 id="ld-how-t">Three steps. No more tab-hopping.</h2></Reveal>
        <div className="ld-steps">
          <Step n="01" title="Discover" text="Browse one fresh feed of hackathons, contests and competitions, filtered the way you think." to="/browse" label="Open the feed" />
          <Step n="02" title="Match" text="Add your skills or resume and see what actually fits, with the reasons spelled out." to="/for-you" label="Get matched" />
          <Step n="03" title="Track and team up" text="Save, apply, build a team and keep every deadline in view from one command centre." to="/tracker" label="Open the tracker" />
        </div>
      </section>

      <section className="ld-stats" aria-label="Live statistics">
        <div><b><CountUp value={stats?.open} /></b><span>open opportunities</span></div>
        <div><b><CountUp value={stats?.platforms?.length} /></b><span>platforms, one feed</span></div>
        <div><b><CountUp value={stats?.closingWeek} /></b><span>closing this week</span></div>
      </section>

      {!user && (
        <Reveal className="ld-final">
          <Emblem size={170} />
          <div><h2>Ready for your next big stage?</h2><p>Create a free account and get matched in minutes.</p>
            <div className="ld-final-btns"><Link className="btn primary" to="/register">Get started free</Link><Link className="btn" to="/login">Sign in</Link></div></div>
        </Reveal>
      )}
    </div>
  );
}

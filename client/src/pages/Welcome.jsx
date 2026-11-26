import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import CollegePicker from '../CollegePicker.jsx';
import ResumeStudio from '../ResumeStudio.jsx';
import { useToast } from '../toast.jsx';

// First-run setup. Asks ONLY for what the recommendation engine is still missing (server: GET /api/me/onboarding),
// saves after every step so nothing is lost, and shows the feed getting "sharper" as you answer.
const GOAL_LABEL = { 'win prizes': '🏆 Win prizes', 'learn new tech': '🧠 Learn new tech', 'build my portfolio': '🛠️ Build my portfolio', 'find a team': '🤝 Find a team', 'get internships': '💼 Land internships', 'meet people': '🎉 Meet people' };
const CITIES = ['Bengaluru', 'Mumbai', 'Delhi NCR', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Ahmedabad'];
const SKILLS = ['Python', 'JavaScript', 'React', 'Node.js', 'Java', 'C++', 'Machine Learning', 'Data Analysis', 'SQL', 'Flutter', 'Figma', 'UI/UX', 'Cloud', 'Docker', 'Solidity', 'Cybersecurity', 'IoT', 'Public Speaking'];
const DOMAINS = ['AI/ML', 'Web Development', 'Data Science', 'Cloud & DevOps', 'Cybersecurity', 'Blockchain & Web3', 'Mobile Development', 'Design', 'Business', 'Competitive Programming', 'Hardware & IoT', 'Software Engineering'];
const EDU = [['undergraduate', '🎓 Undergrad'], ['postgraduate', '📚 Postgrad'], ['phd', '🔬 PhD'], ['school', '🏫 School'], ['working', '💻 Working']];
const MODES = [['ONLINE', '🌐 Online'], ['OFFLINE', '📍 In person'], ['HYBRID', '🔀 Hybrid']];
const TYPES = [['HACKATHON', '⚡ Hackathons'], ['CASE STUDY', '📊 Case studies'], ['CONTEST', '⏱️ Coding contests'], ['DESIGN', '🎨 Design challenges']];
const toggle = (list, x) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
const year = new Date().getFullYear();

function Chips({ options, value, onToggle, single = false }) {
  return (
    <div className="chips big">
      {options.map(([v, label]) => {
        const on = single ? value === v : value.includes(v);
        return <button type="button" key={v} className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => onToggle(v)}>{label}</button>;
      })}
    </div>
  );
}

export default function Welcome() {
  const { user, setUser } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [gap, setGap] = useState(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [a, setA] = useState(() => ({
    goals: user.onboarding?.goals || [],
    city: user.location?.city || '', travel: !!user.preferences?.willingToTravel,
    college: user.college || '', level: user.education?.level || '', gradYear: user.education?.gradYear || '',
    skills: user.skills || [], newSkill: '',
    interests: user.interests || [],
    modes: user.preferences?.modes || [], types: user.preferences?.types || [], team: !!user.social?.lookingForTeam,
  }));
  const set = (patch) => setA((x) => ({ ...x, ...patch }));
  const load = () => api.onboarding().then(setGap).catch(() => setGap({ missing: [], completeness: 0 }));
  useEffect(() => { load(); }, []);

  // Build the steps from what is missing (goals and the finish screen always show)
  const steps = useMemo(() => {
    if (!gap) return [];
    const need = new Set(gap.missing.map((m) => m.field));
    const s = ['intro'];
    if (need.has('city')) s.push('city');
    if (need.has('college') || need.has('education') || need.has('gradYear')) s.push('study');
    if (need.has('skills')) s.push('skills');
    if (need.has('interests')) s.push('interests');
    if (need.has('modes') || need.has('types')) s.push('style');
    s.push('done');
    return s;
  }, [gap]);

  // Live "match power" from the answers so far (mirrors the server weights in services/profileGaps.js)
  const power = useMemo(() => Math.min(100,
    (a.city ? 15 : 0) + (a.college ? 10 : 0) + (a.level ? 15 : 0) + (a.gradYear || a.level === 'working' ? 5 : 0)
    + (a.skills.length >= 3 ? 25 : a.skills.length * 8) + (a.interests.length ? 15 : 0) + (a.modes.length ? 10 : 0) + (a.types.length ? 5 : 0)), [a]);

  async function save(kind) {
    const b = {};
    if (kind === 'intro') b.onboarding = { goals: a.goals };
    if (kind === 'city') { b.location = { city: a.city.trim(), state: user.location?.state || '', country: user.location?.country || 'India' }; b.preferences = { willingToTravel: a.travel }; }
    if (kind === 'study') { if (a.college.trim()) b.college = a.college.trim(); b.education = { level: a.level, gradYear: a.gradYear }; }
    if (kind === 'skills') b.skills = a.skills;
    if (kind === 'interests') b.interests = a.interests;
    if (kind === 'style') { b.preferences = { modes: a.modes, types: a.types }; b.social = { lookingForTeam: a.team }; }
    if (kind === 'done') b.onboarding = { complete: true, goals: a.goals };
    if (!Object.keys(b).length) return true;
    try { const r = await api.updateProfile(b); setUser(r.user); return true; } catch (e) { toast(e.message, 'err'); return false; }
  }
  async function next() {
    setBusy(true);
    const ok = await save(steps[step]);
    setBusy(false);
    if (ok) setStep((s) => Math.min(steps.length - 1, s + 1));
  }
  async function finish(to) { setBusy(true); await save('done'); setBusy(false); nav(to); }
  async function skip() { try { const r = await api.updateProfile({ onboarding: { skip: true } }); setUser(r.user); } catch { /* still leave */ } nav('/'); }

  if (!gap) return <p className="muted">Getting things ready…</p>;
  const kind = steps[step];
  const canNext = {
    intro: true, city: a.city.trim().length >= 2, study: !!a.level, skills: a.skills.length >= 1, interests: a.interests.length >= 1, style: a.modes.length >= 1,
  }[kind];
  const addSkill = () => { const s = a.newSkill.trim(); if (s && !a.skills.includes(s)) set({ skills: [...a.skills, s].slice(0, 30), newSkill: '' }); else set({ newSkill: '' }); };

  return (
    <div className="welcome">
      <div className="welcome-top">
        <div className="power" aria-label={`Match power ${power} percent`}>
          <span className="small muted">Match power</span>
          <div className="power-bar"><span style={{ width: `${power}%` }} /></div>
          <strong>{power}%</strong>
        </div>
        {kind !== 'done' && <button className="link small" onClick={skip}>Skip for now</button>}
      </div>
      <p className="small muted">Step {step + 1} of {steps.length}</p>

      {kind === 'intro' && (
        <section className="panel welcome-card">
          <h1>Hey {user.name.split(' ')[0]} 👋 let’s find your next win</h1>
          <p>Answer a few quick taps and we’ll line up hackathons that actually fit you. Takes under a minute.</p>
          <h2>What are you here for?</h2>
          <Chips options={(gap.goalOptions || Object.keys(GOAL_LABEL)).map((g) => [g, GOAL_LABEL[g] || g])} value={a.goals} onToggle={(g) => set({ goals: toggle(a.goals, g) })} />
          {!gap.fromResume && (
            <details className="resume-shortcut">
              <summary>⚡ Shortcut: drop your resume and we’ll fill in your skills for you</summary>
              <ResumeStudio title="Your resume" onChange={(u) => { if (u) { setUser(u); set({ skills: u.skills || a.skills, college: u.college || a.college, gradYear: u.education?.gradYear || a.gradYear }); load(); } }} />
            </details>
          )}
          {gap.fromResume && <p className="ok small">✓ We read your resume: {gap.fromResume.skills.slice(0, 6).join(', ')}{gap.fromResume.skills.length > 6 ? '…' : ''}. We’ll only ask what it didn’t tell us.</p>}
        </section>
      )}

      {kind === 'city' && (
        <section className="panel welcome-card">
          <h1>📍 Where are you based?</h1>
          <p className="muted">We push events you can actually get to, and still show the best online ones.</p>
          <Chips options={CITIES.map((c) => [c, c])} value={a.city} single onToggle={(c) => set({ city: c })} />
          <label>Somewhere else?<input value={CITIES.includes(a.city) ? '' : a.city} onChange={(e) => set({ city: e.target.value })} placeholder="Type your city" maxLength={80} /></label>
          <label className="chk"><input type="checkbox" checked={a.travel} onChange={(e) => set({ travel: e.target.checked })} /> I’m happy to travel for a great in-person event ✈️</label>
        </section>
      )}

      {kind === 'study' && (
        <section className="panel welcome-card">
          <h1>🎓 Where do you study (or work)?</h1>
          <p className="muted">Unlocks college-only events and filters out ones you’re not eligible for.</p>
          <Chips options={EDU} value={a.level} single onToggle={(l) => set({ level: l })} />
          {a.level !== 'working' && (
            <>
              <CollegePicker value={a.college} onChange={(v) => set({ college: v })} />
              <p className="small muted">Not in the list? Type the full name and pick “Add”. It’ll show up for your classmates too.</p>
              <label>Graduation year<select value={a.gradYear || ''} onChange={(e) => set({ gradYear: e.target.value })}>
                <option value="">—</option>{Array.from({ length: 9 }, (_, i) => year - 2 + i).map((y) => <option key={y} value={y}>{y}</option>)}
              </select></label>
            </>
          )}
        </section>
      )}

      {kind === 'skills' && (
        <section className="panel welcome-card">
          <h1>🧰 What can you build with?</h1>
          <p className="muted">Pick at least three. This is the biggest signal for your matches.</p>
          <Chips options={[...new Set([...SKILLS, ...a.skills])].map((s) => [s, s])} value={a.skills} onToggle={(s) => set({ skills: toggle(a.skills, s) })} />
          <div className="row">
            <input value={a.newSkill} onChange={(e) => set({ newSkill: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }} placeholder="Add another skill" maxLength={40} aria-label="Add another skill" />
            <button type="button" className="btn ghost" onClick={addSkill}>Add</button>
          </div>
          {a.skills.length > 0 && a.skills.length < 3 && <p className="small warm">{3 - a.skills.length} more for sharper picks 🔥</p>}
        </section>
      )}

      {kind === 'interests' && (
        <section className="panel welcome-card">
          <h1>✨ What gets you excited?</h1>
          <p className="muted">Your feed leads with these.</p>
          <Chips options={DOMAINS.map((d) => [d, d])} value={a.interests} onToggle={(d) => set({ interests: toggle(a.interests, d).slice(0, 12) })} />
        </section>
      )}

      {kind === 'style' && (
        <section className="panel welcome-card">
          <h1>🎮 How do you like to compete?</h1>
          <Chips options={MODES} value={a.modes} onToggle={(m) => set({ modes: toggle(a.modes, m) })} />
          <h2>Which kinds?</h2>
          <Chips options={TYPES} value={a.types} onToggle={(t) => set({ types: toggle(a.types, t) })} />
          <label className="chk"><input type="checkbox" checked={a.team} onChange={(e) => set({ team: e.target.checked })} /> I’m looking for teammates 🤝</label>
        </section>
      )}

      {kind === 'done' && (
        <section className="panel welcome-card center">
          <h1>🚀 You’re all set!</h1>
          <p>Your feed is <strong>{power}%</strong> tuned to you. We’ll ping you when a great match opens up.</p>
          <div className="row center">
            <button className="btn primary" disabled={busy} onClick={() => finish('/for-you')}>See my picks</button>
            <button className="btn ghost" disabled={busy} onClick={() => finish('/network')}>Find teammates</button>
          </div>
          <p className="small muted">You can change any of this later in <Link to="/profile">your profile</Link>.</p>
        </section>
      )}

      {kind !== 'done' && (
        <div className="row-between welcome-nav">
          <button className="btn ghost" disabled={step === 0 || busy} onClick={() => setStep((s) => Math.max(0, s - 1))}>Back</button>
          <button className="btn primary" disabled={!canNext || busy} onClick={next}>{step === steps.length - 2 ? 'Finish' : 'Next'} →</button>
        </div>
      )}
    </div>
  );
}

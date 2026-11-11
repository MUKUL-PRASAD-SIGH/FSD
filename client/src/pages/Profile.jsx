import { useEffect, useRef, useState } from 'react';
import { INDIA, STATES, normaliseCity, stateOfCity } from '../data/india.js';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../toast.jsx';
import ResumeStudio from '../ResumeStudio.jsx';
import { PasswordMeter, passwordOk } from '../forms.jsx';

const DOMAINS = ['AI/ML', 'Web Development', 'Data Science', 'Cloud & DevOps', 'Cybersecurity', 'Blockchain & Web3', 'Mobile Development', 'Design', 'Business', 'Competitive Programming', 'Hardware & IoT', 'Software Engineering'];
const toList = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

function DeleteAccount() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  async function go(e) { e.preventDefault(); setErr(''); try { await api.deleteAccount(pw); logout(); } catch (x) { setErr(x.message); } }
  if (!open) return <button type="button" className="link small" onClick={() => setOpen(true)}>Delete my account</button>;
  return (
    <form onSubmit={go} className="panel" style={{ margin: '12px 0 0' }}>
      <p className="small">This permanently removes your account, resume data, saved events and notifications.</p>
      {user.hasPassword && <label>Confirm your password<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required /></label>}
      {err && <p className="error" role="alert">{err}</p>}
      <div className="row"><button className="btn primary">Delete permanently</button><button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button></div>
    </form>
  );
}

function Security() {
  const { user, adopt, logout } = useAuth();
  const [f, setF] = useState({ current: '', password: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault(); setMsg(''); setErr('');
    if (!passwordOk(f.password, { email: user.email, name: user.name })) return setErr('Please meet all the password requirements.');
    try { adopt(await api.changePassword(f)); setF({ current: '', password: '' }); setMsg('Password updated. Other devices were signed out.'); } catch (x) { setErr(x.message); }
  }
  return (
    <section className="panel">
      <h2>Security</h2>
      <form onSubmit={submit}>
        {user.hasPassword && <label>Current password<input type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} required /></label>}
        <label>{user.hasPassword ? 'New password' : 'Set a password (optional, you can keep using Google)'}<input type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></label>
        <PasswordMeter password={f.password} email={user.email} name={user.name} />
        {msg && <p className="ok" role="status">{msg}</p>}{err && <p className="error" role="alert">{err}</p>}
        <div className="row"><button className="btn primary">{user.hasPassword ? 'Change password' : 'Set password'}</button>
          <button type="button" className="btn ghost" onClick={async () => { await api.logoutAll(); logout(); }}>Sign out everywhere</button></div>
      </form>
      <DeleteAccount />
    </section>
  );
}

export default function Profile() {
  const { user, setUser, isPro } = useAuth();
  const fileRef = useRef(null);
  const [skills, setSkills] = useState((user.skills || []).join(', '));
  const [interests, setInterests] = useState(user.interests || []);
  const [prefs, setPrefs] = useState(user.preferences || {});
  const [loc, setLoc] = useState(user.location || { city: '', state: '' });
  // Location saves itself as soon as it's chosen, so leaving the page without pressing Save never loses it.
  const toast = useToast();
  const firstLoc = useRef(true);
  useEffect(() => {
    if (firstLoc.current) { firstLoc.current = false; return undefined; }
    if (!loc.state && !loc.city && !loc.country) return undefined;
    const t = setTimeout(() => {
      api.updateProfile({ location: loc }).then((r) => { setUser(r.user); toast('Location saved', 'good'); }).catch((e) => toast(e.message, 'err'));
    }, 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.state, loc.city, loc.country]);
  const [edu, setEdu] = useState(user.education || { level: '', gradYear: '' });
  const [notify, setNotify] = useState(user.notify || { inApp: true, email: false, minMatch: 55 });
  const [college, setCollege] = useState(user.college || '');
  const [bio, setBio] = useState(user.bio || '');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const sync = (u) => { setUser(u); setSkills(u.skills.join(', ')); setInterests(u.interests); setCollege(u.college || ''); setEdu(u.education || {}); };

  async function upload(file) {
    if (!file) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      const r = await api.uploadResume(file);
      sync(r.user);
      setMsg(`Read ${r.parsed.wordCount} words, found ${r.user.resume.skills.length} skills and indexed your resume for the assistant. Review below, then save.`);
    } catch (e) { setErr(e.message); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  }
  async function save(e) {
    e.preventDefault(); setBusy(true); setErr(''); setMsg('');
    try {
      const r = await api.updateProfile({ skills: toList(skills), interests, college, bio, preferences: prefs, location: loc, education: { level: edu.level || '', gradYear: edu.gradYear }, notify });
      sync(r.user); setMsg('Saved. Your picks and notifications update immediately.');
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  const toggle = (arr = [], v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const r = user.resume;

  return (
    <>
      <div className="row-between"><h1>Your profile</h1><Link className={`pill ${isPro ? '' : 'warm'}`} to="/plan">{isPro ? 'Pro plan' : 'Free plan · upgrade'}</Link></div>

      <ResumeStudio title="Resume" onChange={(u) => u && sync(u)} />

      <form className="panel" onSubmit={save}>
        <h2>What we match on</h2>
        <label>Skills <span className="muted small">(comma separated)</span><textarea rows={2} value={skills} onChange={(e) => setSkills(e.target.value)} /></label>
        <fieldset><legend>Interests</legend>
          <div className="chips">{DOMAINS.map((d) => <button type="button" key={d} className={`chip ${interests.includes(d) ? 'on' : ''}`} aria-pressed={interests.includes(d)} onClick={() => setInterests(toggle(interests, d))}>{d}</button>)}</div>
        </fieldset>
        <div className="form-grid">
          <LocationPicker loc={loc} setLoc={setLoc} />
          <label>Education level<select value={edu.level || ''} onChange={(e) => setEdu({ ...edu, level: e.target.value })}>
            <option value="">—</option><option value="school">School</option><option value="undergraduate">Undergraduate</option><option value="postgraduate">Postgraduate</option><option value="phd">PhD</option><option value="working">Working</option></select></label>
          <label>Graduation year<input type="number" min="1990" max="2040" value={edu.gradYear || ''} onChange={(e) => setEdu({ ...edu, gradYear: e.target.value })} /></label>
        </div>
        {!isPro && <p className="muted small">Location and education are used by the Pro ranking. <Link to="/plan">Upgrade</Link></p>}
        <fieldset><legend>Preferences</legend>
          <div className="chips">
            {['ONLINE', 'OFFLINE', 'HYBRID'].map((m) => <button type="button" key={m} className={`chip ${prefs.modes?.includes(m) ? 'on' : ''}`} aria-pressed={!!prefs.modes?.includes(m)} onClick={() => setPrefs({ ...prefs, modes: toggle(prefs.modes, m) })}>{m.toLowerCase()}</button>)}
            {['HACKATHON', 'CASE STUDY', 'CONTEST', 'DESIGN'].map((t) => <button type="button" key={t} className={`chip ${prefs.types?.includes(t) ? 'on' : ''}`} aria-pressed={!!prefs.types?.includes(t)} onClick={() => setPrefs({ ...prefs, types: toggle(prefs.types, t) })}>{t.toLowerCase()}</button>)}
          </div>
          <div className="row">
            <label className="chk"><input type="checkbox" checked={!!prefs.freeOnly} onChange={(e) => setPrefs({ ...prefs, freeOnly: e.target.checked })} /> free entry only</label>
            <label className="chk"><input type="checkbox" checked={!!prefs.willingToTravel} onChange={(e) => setPrefs({ ...prefs, willingToTravel: e.target.checked })} /> I can travel for events</label>
            <label>Min prize (₹)<input type="number" min="0" step="10000" value={prefs.minPrizeInr || 0} onChange={(e) => setPrefs({ ...prefs, minPrizeInr: Number(e.target.value) })} /></label>
          </div>
        </fieldset>
        <fieldset><legend>Notifications</legend>
          <div className="row">
            <label className="chk"><input type="checkbox" checked={!!notify.inApp} onChange={(e) => setNotify({ ...notify, inApp: e.target.checked })} /> in-app alerts</label>
            <label className="chk"><input type="checkbox" checked={!!notify.email} onChange={(e) => setNotify({ ...notify, email: e.target.checked })} /> email digest</label>
            <label>Only if match ≥ {notify.minMatch}%<input type="range" min="30" max="95" step="5" value={notify.minMatch} onChange={(e) => setNotify({ ...notify, minMatch: Number(e.target.value) })} /></label>
          </div>
        </fieldset>
        <label>College / institute<input value={college} onChange={(e) => setCollege(e.target.value)} /></label>
        <label>About you<textarea rows={2} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Anything else that should shape your picks" /></label>
        {msg && <p className="ok" role="status">{msg}</p>}{err && <p className="error" role="alert">{err}</p>}
        <button className="btn primary" disabled={busy}>Save profile</button>
      </form>
      <Security />
    </>
  );
}

// State first, then the cities of that state. "Outside India" switches to free-text country / state / city.
function LocationPicker({ loc, setLoc }) {
  const abroad = !!loc.country && loc.country.toLowerCase() !== 'india';
  const derivedState = STATES.includes(loc.state) ? loc.state : stateOfCity(loc.city);
  const state = abroad ? '__other' : derivedState;
  const city = normaliseCity(loc.city);
  const known = state && state !== '__other' ? INDIA[state] : [];
  const cityIsOther = !!city && !known.includes(city);
  const [other, setOther] = useState(cityIsOther);

  const pickState = (v) => {
    if (v === '__other') return setLoc({ ...loc, country: abroad ? loc.country : '', state: '', city: '' });
    setOther(false);
    setLoc({ ...loc, country: 'India', state: v, city: '' });
  };
  const pickCity = (v) => {
    if (v === '__other') { setOther(true); return setLoc({ ...loc, city: '' }); }
    setOther(false); setLoc({ ...loc, city: v });
  };

  return (
    <>
      <label>State / union territory
        <select value={state} onChange={(e) => pickState(e.target.value)}>
          <option value="">Select your state</option>
          {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          <option value="__other">Outside India</option>
        </select>
      </label>
      {state === '__other' ? (
        <>
          <label>Country<input value={loc.country || ''} onChange={(e) => setLoc({ ...loc, country: e.target.value })} placeholder="e.g. Bangladesh" /></label>
          <label>State / region<input value={loc.state || ''} onChange={(e) => setLoc({ ...loc, state: e.target.value })} /></label>
          <label>City<input value={loc.city || ''} onChange={(e) => setLoc({ ...loc, city: e.target.value })} placeholder="e.g. Dhaka" /></label>
        </>
      ) : (
        <>
          <label>City
            <select value={other ? '__other' : known.includes(city) ? city : ''} onChange={(e) => pickCity(e.target.value)} disabled={!state}>
              <option value="">{state ? 'Select your city' : 'Choose a state first'}</option>
              {known.map((c) => <option key={c} value={c}>{c}</option>)}
              {state && <option value="__other">Other city…</option>}
            </select>
          </label>
          {other && state && <label>Your city<input value={loc.city || ''} onChange={(e) => setLoc({ ...loc, city: e.target.value })} placeholder={`City in ${state}`} /></label>}
        </>
      )}
    </>
  );
}

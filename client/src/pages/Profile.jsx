import { useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Empty } from '../components.jsx';

const DOMAINS = ['AI/ML', 'Web Development', 'Data Science', 'Cloud & DevOps', 'Cybersecurity', 'Blockchain & Web3', 'Mobile Development', 'Design', 'Business', 'Competitive Programming', 'Hardware & IoT', 'Software Engineering'];
const toList = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

export default function Profile() {
  const { user, setUser, openAuth } = useAuth();
  const fileRef = useRef(null);
  const [skills, setSkills] = useState((user?.skills || []).join(', '));
  const [interests, setInterests] = useState(user?.interests || []);
  const [prefs, setPrefs] = useState(user?.preferences || {});
  const [college, setCollege] = useState(user?.college || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user) return <Empty><p>Sign in to build your profile.</p><button className="btn primary" onClick={openAuth}>Sign in</button></Empty>;

  const sync = (u) => { setUser(u); setSkills(u.skills.join(', ')); setInterests(u.interests); setCollege(u.college || ''); };

  async function upload(file) {
    if (!file) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      const r = await api.uploadResume(file);
      sync(r.user);
      setMsg(`Read ${r.parsed.wordCount} words and found ${r.user.resume.skills.length} skills. Review them below, then save.`);
    } catch (e) { setErr(e.message); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  }
  async function removeResume() {
    setBusy(true);
    try { setUser((await api.deleteResume()).user); setMsg('Resume data removed. Your edited skills are kept.'); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  async function save(e) {
    e.preventDefault();
    setBusy(true); setErr(''); setMsg('');
    try {
      const r = await api.updateProfile({ skills: toList(skills), interests, college, bio, preferences: prefs });
      sync(r.user); setMsg('Saved. Your picks update immediately.');
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const r = user.resume;

  return (
    <>
      <h1>Your profile</h1>
      <section className="panel">
        <h2>Resume</h2>
        <p className="muted small">PDF, DOCX or TXT, up to 5 MB. The file is read in memory and not stored; only the text we extract and the skills we find are saved.</p>
        <div className="row">
          <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" onChange={(e) => upload(e.target.files[0])} disabled={busy} aria-label="Upload resume" />
          {r?.parsedAt && <button className="link" onClick={removeResume}>Remove parsed data</button>}
        </div>
        {r?.parsedAt && (
          <div className="parsed">
            <p className="small">Parsed <strong>{r.fileName}</strong> on {new Date(r.parsedAt).toLocaleDateString()}{r.graduationYear ? ` · graduating ${r.graduationYear}` : ''}</p>
            {r.domains.length > 0 && (
              <div className="bars" aria-label="Domain strengths">
                {r.domains.slice(0, 5).map((d) => (
                  <div key={d.name} className="bar"><span>{d.name}</span><i style={{ width: `${Math.round(d.score * 100)}%` }} /><b>{Math.round(d.score * 100)}%</b></div>
                ))}
              </div>
            )}
            {r.experienceKeywords.length > 0 && <p className="muted small">Signals: {r.experienceKeywords.join(', ')}</p>}
          </div>
        )}
      </section>

      <form className="panel" onSubmit={save}>
        <h2>What we match on</h2>
        <label>Skills <span className="muted small">(comma separated — edit anything the parser got wrong)</span>
          <textarea rows={3} value={skills} onChange={(e) => setSkills(e.target.value)} />
        </label>
        <fieldset>
          <legend>Interests</legend>
          <div className="chips">
            {DOMAINS.map((d) => <button type="button" key={d} className={`chip ${interests.includes(d) ? 'on' : ''}`} aria-pressed={interests.includes(d)} onClick={() => setInterests(toggle(interests, d))}>{d}</button>)}
          </div>
        </fieldset>
        <fieldset>
          <legend>Preferences</legend>
          <div className="chips">
            {['ONLINE', 'OFFLINE', 'HYBRID'].map((m) => <button type="button" key={m} className={`chip ${prefs.modes?.includes(m) ? 'on' : ''}`} aria-pressed={!!prefs.modes?.includes(m)} onClick={() => setPrefs({ ...prefs, modes: toggle(prefs.modes || [], m) })}>{m.toLowerCase()}</button>)}
            {['HACKATHON', 'CASE STUDY', 'CONTEST', 'DESIGN'].map((t) => <button type="button" key={t} className={`chip ${prefs.types?.includes(t) ? 'on' : ''}`} aria-pressed={!!prefs.types?.includes(t)} onClick={() => setPrefs({ ...prefs, types: toggle(prefs.types || [], t) })}>{t.toLowerCase()}</button>)}
          </div>
          <div className="row">
            <label className="chk"><input type="checkbox" checked={!!prefs.freeOnly} onChange={(e) => setPrefs({ ...prefs, freeOnly: e.target.checked })} /> free entry only</label>
            <label>Min prize (₹) <input type="number" min="0" step="10000" value={prefs.minPrizeInr || 0} onChange={(e) => setPrefs({ ...prefs, minPrizeInr: Number(e.target.value) })} /></label>
          </div>
        </fieldset>
        <label>College / institute<input value={college} onChange={(e) => setCollege(e.target.value)} /></label>
        <label>About you<textarea rows={2} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Anything else that should shape your picks" /></label>
        {msg && <p className="ok" role="status">{msg}</p>}
        {err && <p className="error" role="alert">{err}</p>}
        <button className="btn primary" disabled={busy}>Save profile</button>
      </form>
    </>
  );
}

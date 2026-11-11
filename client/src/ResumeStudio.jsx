import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from './api.js';
import { useAuth } from './auth.jsx';
import { useToast } from './toast.jsx';

// One resume component for the whole app (For you + Profile).
//  - no resume yet  -> drop zone
//  - resume saved   -> summary of what we understood + "Update resume" / "Remove"; it never asks again
// The resume is parsed in memory (the file itself is not stored); the extracted data lives on the signed-in user's own
// account and every read is scoped by the session token, so recommendations built from it are private to them.
export default function ResumeStudio({ onChange, title = 'Resume Studio' }) {
  const { user, isPro, setUser } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const input = useRef(null);
  const r = user?.resume;

  async function handle(file) {
    if (!file) return;
    setBusy(true);
    try {
      const res = await api.uploadResume(file);
      setUser(res.user);
      toast(`${r ? 'Resume updated' : 'Resume saved'}: ${res.user.resume.skills.length} skills found. Your picks are refreshed.`, 'good');
      onChange?.(res.user);
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); if (input.current) input.current.value = ''; }
  }
  async function remove() {
    try { const res = await api.deleteResume(); setUser(res.user); toast('Resume data removed', 'good'); onChange?.(res.user); } catch (e) { toast(e.message, 'err'); }
  }
  const pick = () => input.current?.click();
  const drop = {
    onDragOver: (e) => { e.preventDefault(); setOver(true); }, onDragLeave: () => setOver(false),
    onDrop: (e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files?.[0]); },
  };

  if (!isPro) {
    return (
      <div className="panel studio">
        <div className="studio-head"><h2>{title} <span className="pill">Pro</span></h2></div>
        <p className="muted">Upload your resume once and we read your skills, projects and domains, then rank every open hackathon against them with explanations. <Link to="/plan">Unlock Pro</Link></p>
      </div>
    );
  }

  const domains = (r?.domains || []).filter((d) => d.score >= 0.1).slice(0, 5);
  return (
    <section className={`panel studio ${over ? 'over' : ''}`} aria-label={title} {...(r ? drop : {})}>
      <div className="studio-head">
        <h2>{title} {r && <span className="pill okp">✓ Saved</span>}</h2>
        {r && <span className="muted small">{r.fileName} · analysed {new Date(r.parsedAt).toLocaleDateString('en-IN')}</span>}
      </div>
      <input ref={input} className="sr-file" type="file" accept=".pdf,.docx,.txt,.md" onChange={(e) => handle(e.target.files?.[0])} aria-label="Upload resume" tabIndex={-1} />

      {!r ? (
        <div
          className={`dz ${over ? 'over' : ''} ${busy ? 'busy' : ''}`} role="button" tabIndex={0} {...drop}
          onClick={pick} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && pick()}
        >
          <span className="big" aria-hidden="true">{busy ? '⏳' : '📄'}</span>
          <strong>{busy ? 'Reading your resume…' : 'Drop your resume here, or click to browse'}</strong>
          <span className="muted small">PDF, DOCX or TXT · up to 5 MB · you only need to do this once</span>
        </div>
      ) : (
        <>
          <div className="understood">
            <div>
              <h3>Interests we inferred</h3>
              {domains.length ? (
                <div className="bars">{domains.map((d) => <div key={d.name} className="bar"><span>{d.name}</span><i style={{ '--w': `${Math.min(100, Math.round(d.score * 100))}%` }} /><b>{Math.round(d.score * 100)}</b></div>)}</div>
              ) : <p className="muted small">No clear domain yet. Add interests in your profile.</p>}
            </div>
            <div>
              <h3>Skills detected ({r.skills.length})</h3>
              <div className="tags">{r.skills.slice(0, 24).map((s) => <span key={s} className="tag">{s}</span>)}</div>
              {r.graduationYear && <p className="muted small">Graduating {r.graduationYear}</p>}
            </div>
          </div>
          <div className="row">
            <button className="btn" onClick={pick} disabled={busy}>{busy ? 'Reading…' : '↻ Update resume'}</button>
            <button className="btn ghost" onClick={remove} disabled={busy}>Remove</button>
            <span className="muted small">Or drop a new file here.</span>
          </div>
        </>
      )}
      <p className="private-note">🔒 Private to you. The file is parsed in memory and never kept; only you can see this analysis or the picks built from it.</p>
    </section>
  );
}

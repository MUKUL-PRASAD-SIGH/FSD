import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { GoogleButton, PasswordMeter, passwordOk } from '../forms.jsx';

const home = (u) => (u.role === 'admin' ? '/admin' : u.role === 'lister' ? '/lister' : '/for-you');

function Shell({ title, sub, children }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
        {children}
      </div>
    </div>
  );
}
const Or = () => <div className="or"><span>or</span></div>;

export function Login() {
  const { user, login, google } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={loc.state?.from || home(user)} replace />;

  const go = (u) => nav(loc.state?.from || home(u), { replace: true });
  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try { go((await login(f)).user); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  async function viaGoogle(credential) {
    setErr('');
    try { go((await google({ credential })).user); } catch (x) { setErr(x.message); }
  }
  return (
    <Shell title="Welcome back" sub="Sign in to see picks, notifications and your tracker.">
      <GoogleButton onCredential={viaGoogle} text="signin_with" />
      <Or />
      <form onSubmit={submit} noValidate>
        <label>Email<input type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label>Password<input type="password" autoComplete="current-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        {err && <p className="error" role="alert">{err}</p>}
        <button className="btn primary wide" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="small"><Link to="/forgot">Forgot your password?</Link></p>
      <p className="small muted">New here? <Link to="/register">Create an account</Link> · <Link to="/register?as=lister">List events as an organiser</Link></p>
    </Shell>
  );
}

export function Register() {
  const { user, register, google } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [type, setType] = useState(sp.get('as') === 'lister' ? 'lister' : 'user');
  const [f, setF] = useState({ name: '', email: '', password: '', organisation: '', website: '', reason: '' });
  const [err, setErr] = useState('');
  const [problems, setProblems] = useState([]);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={home(user)} replace />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const lister = type === 'lister';
  const extras = lister ? { organisation: f.organisation, website: f.website, reason: f.reason } : {};

  async function submit(e) {
    e.preventDefault(); setErr(''); setProblems([]);
    if (!passwordOk(f.password, { email: f.email, name: f.name })) return setErr('Please meet all the password requirements below.');
    setBusy(true);
    try { const r = await register({ name: f.name, email: f.email, password: f.password, accountType: type, ...extras }); nav(home(r.user), { replace: true }); }
    catch (x) { setErr(x.message); setProblems(x.problems || []); } finally { setBusy(false); }
  }
  async function viaGoogle(credential) {
    setErr('');
    if (lister && f.organisation.trim().length < 2) return setErr('Enter your organisation name first, then use Google.');
    try { const r = await google({ credential, accountType: type, ...extras }); nav(home(r.user), { replace: true }); } catch (x) { setErr(x.message); }
  }
  return (
    <Shell title="Create your account" sub={lister ? 'Organisers can publish events after an admin approves the account.' : 'Free forever. Upgrade to Pro for resume-powered picks.'}>
      <div className="seg" role="tablist" aria-label="Account type">
        <button type="button" role="tab" aria-selected={!lister} className={!lister ? 'on' : ''} onClick={() => setType('user')}>I’m looking for events</button>
        <button type="button" role="tab" aria-selected={lister} className={lister ? 'on' : ''} onClick={() => setType('lister')}>I run events</button>
      </div>
      {lister && (
        <>
          <label>Organisation / community<input required value={f.organisation} onChange={set('organisation')} placeholder="e.g. Pune AI Club" /></label>
          <label>Website <span className="muted small">(optional)</span><input type="url" value={f.website} onChange={set('website')} placeholder="https://" /></label>
          <label>What will you list? <span className="muted small">(helps the admin approve you)</span><textarea rows={2} value={f.reason} onChange={set('reason')} /></label>
        </>
      )}
      <GoogleButton onCredential={viaGoogle} text="signup_with" />
      <Or />
      <form onSubmit={submit} noValidate>
        <label>Full name<input autoComplete="name" required value={f.name} onChange={set('name')} /></label>
        <label>Email<input type="email" autoComplete="email" required value={f.email} onChange={set('email')} /></label>
        <label>Password<input type="password" autoComplete="new-password" required value={f.password} onChange={set('password')} /></label>
        <PasswordMeter password={f.password} email={f.email} name={f.name} />
        {err && <p className="error" role="alert">{err}</p>}
        {problems.length > 0 && <ul className="error small">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
        <button className="btn primary wide" disabled={busy}>{busy ? 'Creating…' : lister ? 'Request lister account' : 'Create account'}</button>
      </form>
      <p className="small muted">Already registered? <Link to="/login">Sign in</Link></p>
    </Shell>
  );
}

export function Forgot() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  async function submit(e) { e.preventDefault(); setErr(''); try { await api.forgot(email); setDone(true); } catch (x) { setErr(x.message); } }
  return (
    <Shell title="Reset your password" sub="We’ll email you a link that works for 30 minutes.">
      {done ? <p className="ok">If that email has an account, a reset link is on its way.</p> : (
        <form onSubmit={submit}>
          <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          {err && <p className="error" role="alert">{err}</p>}
          <button className="btn primary wide">Send reset link</button>
        </form>
      )}
      <p className="small"><Link to="/login">Back to sign in</Link></p>
    </Shell>
  );
}

export function Reset() {
  const [sp] = useSearchParams();
  const { adopt } = useAuth();
  const nav = useNavigate();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault(); setErr('');
    if (!passwordOk(pw)) return setErr('Please meet all the password requirements.');
    try { adopt(await api.reset({ token: sp.get('token'), password: pw })); nav('/', { replace: true }); } catch (x) { setErr(x.message); }
  }
  return (
    <Shell title="Choose a new password">
      <form onSubmit={submit}>
        <label>New password<input type="password" autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        <PasswordMeter password={pw} />
        {err && <p className="error" role="alert">{err}</p>}
        <button className="btn primary wide">Update password</button>
      </form>
    </Shell>
  );
}

export function Verify() {
  const [sp] = useSearchParams();
  const { user, refresh } = useAuth();
  const [state, setState] = useState('working');
  useEffect(() => {
    api.verifyEmail(sp.get('token') || '').then(() => { setState('ok'); if (user) refresh(); }).catch(() => setState('bad'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Shell title="Email verification">
      {state === 'working' && <p className="muted" aria-live="polite">Verifying…</p>}
      {state === 'ok' && <p className="ok">Your email is verified. Thank you!</p>}
      {state === 'bad' && <p className="error">This link is invalid or has expired. Sign in and request a new one from the banner at the top.</p>}
      <Link className="btn primary wide" to="/">Continue</Link>
    </Shell>
  );
}

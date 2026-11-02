import { useState } from 'react';
import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Home from './pages/Home.jsx';
import ForYou from './pages/ForYou.jsx';
import Profile from './pages/Profile.jsx';
import Tracker from './pages/Tracker.jsx';
import Ask from './pages/Ask.jsx';

function AuthModal() {
  const { authOpen, closeAuth, login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (!authOpen) return null;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try { mode === 'login' ? await login({ email: f.email, password: f.password }) : await register(f); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  return (
    <div className="overlay" onClick={closeAuth}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        <p className="muted small">Browsing is open to everyone. An account lets you save listings and get picks based on your resume.</p>
        {mode === 'register' && <label>Name<input required value={f.name} onChange={set('name')} autoComplete="name" /></label>}
        <label>Email<input required type="email" value={f.email} onChange={set('email')} autoComplete="email" /></label>
        <label>Password<input required type="password" minLength={6} value={f.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
        {err && <p className="error" role="alert">{err}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Sign up'}</button>
        <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }}>
          {mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}

function Theme() {
  const [t, setT] = useState(document.documentElement.dataset.theme || 'dark');
  const flip = () => {
    const n = t === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = n; setT(n);
    try { localStorage.setItem('theme', n); } catch { /* ignore */ }
  };
  return <button className="btn ghost icon" onClick={flip} aria-label="Toggle theme">{t === 'dark' ? '☀' : '☾'}</button>;
}

export default function App() {
  const { user, ready, openAuth, logout } = useAuth();
  const link = ({ isActive }) => (isActive ? 'active' : '');
  return (
    <>
      <header className="top">
        <NavLink to="/" className="brand">HACKELITE<span>.ai</span></NavLink>
        <nav>
          <NavLink to="/" end className={link}>Browse</NavLink>
          <NavLink to="/for-you" className={link}>For you</NavLink>
          <NavLink to="/ask" className={link}>Ask</NavLink>
          <NavLink to="/tracker" className={link}>Tracker</NavLink>
        </nav>
        <div className="top-right">
          <Theme />
          {user ? (
            <>
              <NavLink to="/profile" className="btn ghost">{user.name.split(' ')[0]}</NavLink>
              <button className="btn ghost" onClick={logout}>Sign out</button>
            </>
          ) : <button className="btn primary" onClick={openAuth}>Sign in</button>}
        </div>
      </header>
      <main>
        {ready && (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/for-you" element={<ForYou />} />
            <Route path="/ask" element={<Ask />} />
            <Route path="/tracker" element={<Tracker />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>
      <footer className="foot">
        <span>HackElite — a student project. Listings link to the organiser, where you register.</span>
        <a href="/api/listings/calendar.ics">Subscribe to deadlines (.ics)</a>
        <a href="/api/listings">JSON API</a>
      </footer>
      <AuthModal />
    </>
  );
}

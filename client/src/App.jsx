import { useState } from 'react';
import { NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Home from './pages/Home.jsx';
import ForYou from './pages/ForYou.jsx';
import Profile from './pages/Profile.jsx';
import Tracker from './pages/Tracker.jsx';
import Ask from './pages/Ask.jsx';
import Assistant from './pages/Assistant.jsx';
import Plan from './pages/Plan.jsx';
import Lister from './pages/Lister.jsx';
import Admin from './pages/Admin.jsx';
import ListingDetail from './pages/ListingDetail.jsx';
import Notifications, { Bell, useNotifications } from './pages/Notifications.jsx';
import { Login, Register, Forgot, Reset } from './pages/Auth.jsx';

// Route guards. The server enforces every one of these again; this is only for a sensible UX.
function Guard({ roles, children }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
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
  const { user, ready, logout, isPro } = useAuth();
  const [notes, reloadNotes] = useNotifications(!!user);
  const link = ({ isActive }) => (isActive ? 'active' : '');
  const g = (roles, el) => <Guard roles={roles}>{el}</Guard>;

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="top">
        <NavLink to="/" className="brand">HACKELITE<span>.ai</span></NavLink>
        <nav aria-label="Main">
          <NavLink to="/" end className={link}>Browse</NavLink>
          {user?.role !== 'admin' && user?.role !== 'lister' && <NavLink to="/for-you" className={link}>For you</NavLink>}
          <NavLink to="/ask" className={link}>Ask</NavLink>
          {user && <NavLink to="/assistant" className={link}>Assistant{!isPro && <span className="pill tiny">Pro</span>}</NavLink>}
          {user && <NavLink to="/tracker" className={link}>Tracker</NavLink>}
          {user?.role === 'lister' && <NavLink to="/lister" className={link}>My events</NavLink>}
          {user?.role === 'admin' && <NavLink to="/admin" className={link}>Admin</NavLink>}
        </nav>
        <div className="top-right">
          <Theme />
          {user ? (
            <>
              <Bell data={notes} reload={reloadNotes} />
              <NavLink to="/plan" className="btn ghost">{isPro ? 'Pro' : 'Upgrade'}</NavLink>
              <NavLink to="/profile" className="btn ghost">{user.name.split(' ')[0]}</NavLink>
              <button className="btn ghost" onClick={logout}>Sign out</button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="btn ghost">Sign in</NavLink>
              <NavLink to="/register" className="btn primary">Sign up</NavLink>
            </>
          )}
        </div>
      </header>
      <main id="main">
        {ready && (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot" element={<Forgot />} />
            <Route path="/reset" element={<Reset />} />
            <Route path="/ask" element={<Ask />} />
            <Route path="/listing/:id" element={<ListingDetail />} />
            <Route path="/for-you" element={g(null, <ForYou />)} />
            <Route path="/assistant" element={g(null, <Assistant />)} />
            <Route path="/tracker" element={g(null, <Tracker />)} />
            <Route path="/notifications" element={g(null, <Notifications />)} />
            <Route path="/plan" element={g(null, <Plan />)} />
            <Route path="/profile" element={g(null, <Profile />)} />
            <Route path="/lister" element={g(['lister', 'admin'], <Lister />)} />
            <Route path="/admin" element={g(['admin'], <Admin />)} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>
      <footer className="foot">
        <span>HackElite — listings link to the organiser, where you register.</span>
        <a href="/api/listings/calendar.ics">Subscribe to deadlines (.ics)</a>
        <a href="/api/listings">JSON API</a>
      </footer>
    </>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function Plan() {
  const { user, setUser, isPro } = useAuth();
  const [info, setInfo] = useState(null);
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.plan().then(setInfo).catch((e) => setErr(e.message)); }, [user?.plan?.tier]);

  async function activate(e) {
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true);
    try { setUser((await api.activatePro(key)).user); setKey(''); setMsg('Pro is active. Upload your resume on the Profile page to personalise everything.'); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  async function downgrade() { setBusy(true); try { setUser((await api.downgrade()).user); setMsg('Switched back to Free.'); } finally { setBusy(false); } }

  return (
    <>
      <h1>Plans</h1>
      <p className="muted">You’re on <strong>{isPro ? 'Pro' : 'Free'}</strong>{user.role === 'admin' ? ' (admins get Pro automatically)' : ''}.</p>
      <div className="plans">
        <section className={`panel plan ${!isPro ? 'current' : ''}`}>
          <h2>Free</h2><p className="price">₹0</p>
          <ul>{info?.features.free.map((f) => <li key={f}>{f}</li>)}</ul>
        </section>
        <section className={`panel plan pro ${isPro ? 'current' : ''}`}>
          <h2>Pro <span className="pill">AI</span></h2><p className="price">Activation key</p>
          <ul>{info?.features.pro.map((f) => <li key={f}>{f}</li>)}</ul>
          {!isPro ? (
            <form onSubmit={activate}>
              <label>Activation key<input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Enter your Pro key" autoComplete="off" required /></label>
              <p className="muted small">Billing isn’t wired up yet. For now Pro switches on with a key set by the site owner (<code>PRO_ACTIVATION_KEYS</code>, see the README).</p>
              <button className="btn primary" disabled={busy}>Activate Pro</button>
            </form>
          ) : user.role !== 'admin' && <button className="btn ghost" onClick={downgrade} disabled={busy}>Switch back to Free</button>}
        </section>
      </div>
      {msg && <p className="ok" role="status">{msg}</p>}
      {err && <p className="error" role="alert">{err}</p>}
    </>
  );
}

export function ProGate({ children, what }) {
  const { isPro } = useAuth();
  if (isPro) return children;
  return (
    <div className="empty">
      <h2>{what} is a Pro feature</h2>
      <p>Pro adds resume parsing, location-aware ranking, the 8-point rubric and the AI assistant.</p>
      <Link className="btn primary" to="/plan">See Pro</Link>
    </div>
  );
}

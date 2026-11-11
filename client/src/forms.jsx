import { useEffect, useRef } from 'react';
import { useAuth } from './auth.jsx';

// Mirrors server/utils/password.js so users get instant feedback. The server is still the source of truth.
export function passwordRules(pw, { email = '', name = '', min = 10 } = {}) {
  return [
    { ok: pw.length >= min, label: `At least ${min} characters` },
    { ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw), label: 'Upper and lower case letters' },
    { ok: /\d/.test(pw), label: 'A number' },
    { ok: /[^A-Za-z0-9]/.test(pw), label: 'A symbol (! @ # $ …)' },
  ];
}

export function PasswordMeter({ password, email, name }) {
  const { cfg } = useAuth();
  const rules = passwordRules(password, { email, name, min: cfg.passwordMinLength });
  const passed = rules.filter((r) => r.ok).length;
  const level = !password ? 0 : passed <= 2 ? 1 : passed === 3 ? 2 : password.length >= 14 ? 4 : 3;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  return (
    <div className="meter" aria-live="polite">
      <div className="meter-bar" role="img" aria-label={`Password strength: ${labels[level] || 'empty'}`}>
        {[1, 2, 3, 4].map((i) => <i key={i} className={i <= level ? `on l${level}` : ''} />)}
      </div>
      <span className="small muted">{labels[level]}</span>
      <ul className="rules">{rules.map((r) => <li key={r.label} className={r.ok ? 'ok' : ''}>{r.ok ? '✓' : '○'} {r.label}</li>)}</ul>
    </div>
  );
}
export const passwordOk = (pw, ctx) => passwordRules(pw, ctx).every((r) => r.ok);

// Google Identity Services button. Renders nothing useful until GOOGLE_CLIENT_ID is configured.
export function GoogleButton({ onCredential, text = 'continue_with' }) {
  const { cfg } = useAuth();
  const box = useRef(null);
  const cb = useRef(onCredential);
  cb.current = onCredential;

  useEffect(() => {
    if (!cfg.googleClientId) return;
    const init = () => {
      if (!window.google?.accounts?.id || !box.current) return;
      window.google.accounts.id.initialize({ client_id: cfg.googleClientId, callback: (r) => cb.current(r.credential), ux_mode: 'popup' });
      window.google.accounts.id.renderButton(box.current, { theme: 'outline', size: 'large', text, shape: 'pill', width: 320 });
    };
    if (window.google?.accounts?.id) return init();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true; s.onload = init;
    document.head.appendChild(s);
  }, [cfg.googleClientId, text]);

  if (!cfg.googleClientId) {
    return (
      <button type="button" className="btn ghost wide" disabled title="Set GOOGLE_CLIENT_ID on the server to enable">
        Continue with Google <span className="muted small">(not configured)</span>
      </button>
    );
  }
  return <div ref={box} className="gbtn" />;
}

import { useEffect, useRef } from 'react';
import { useAuth } from './auth.jsx';

// Mirrors server/utils/password.js so users get instant feedback. The server is still the source of truth.
const COMMON_BASES = ['password', 'passw', 'qwerty', 'welcome', 'letmein', 'iloveyou', 'admin', 'administrator', 'hackelite', 'student', 'football', 'dragon', 'monkey', 'changeme', 'secret', 'princess', 'sunshine', 'master', 'login', 'india', 'cricket', 'abcdef'];

export function passwordRules(pw, { email = '', name = '', min = 10 } = {}) {
  const lower = pw.toLowerCase();
  const letters = lower.replace(/@/g, 'a').replace(/0/g, 'o').replace(/\$/g, 's').replace(/3/g, 'e').replace(/5/g, 's').replace(/[^a-z]/g, '');
  const common = COMMON_BASES.some((b) => letters === b || (letters.startsWith(b) && letters.length - b.length <= 3) || (letters.endsWith(b) && letters.length - b.length <= 3)) || /(0123|1234|2345|abcd|qwer)/i.test(pw);
  const local = email.split('@')[0].toLowerCase();
  const first = name.trim().split(/\s+/)[0].toLowerCase();
  return [
    { ok: pw.length >= min, label: `At least ${min} characters` },
    { ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw), label: 'Upper and lower case letters' },
    { ok: /\d/.test(pw), label: 'A number' },
    { ok: /[^A-Za-z0-9]/.test(pw), label: 'A symbol (! @ # $ …)' },
    { ok: !!pw && !common && !(local.length >= 4 && lower.includes(local)) && !(first.length >= 4 && lower.includes(first)), label: 'Not a common word, and not your name or email' },
  ];
}

export function PasswordMeter({ password, email, name }) {
  const { cfg } = useAuth();
  const rules = passwordRules(password, { email, name, min: cfg.passwordMinLength });
  const passed = rules.filter((r) => r.ok).length;
  const level = !password ? 0 : passed <= 2 ? 1 : passed <= 4 ? 2 : password.length >= 14 ? 4 : 3;
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

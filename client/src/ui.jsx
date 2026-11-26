import { useEffect, useRef, useState } from 'react';
import './ui.css';

// Shared visual primitives. Pure React + CSS (no animation library); every animation here is skipped when the
// visitor prefers reduced motion.

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// true once the element has scrolled into view (never flips back, so reveals play once)
export function useInView(rootMargin = '0px 0px -8% 0px') {
  const ref = useRef(null);
  const [seen, setSeen] = useState(() => reducedMotion() || typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (seen || !ref.current) return undefined;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { rootMargin });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [seen, rootMargin]);
  return [ref, seen];
}

// Fades and lifts its children in when scrolled into view. `delay` is in ms (stagger siblings).
export function Reveal({ as: Tag = 'div', delay = 0, className = '', children, ...rest }) {
  const [ref, seen] = useInView();
  return <Tag ref={ref} className={`rv ${seen ? 'in' : ''} ${className}`} style={{ '--d': `${delay}ms`, ...rest.style }} {...rest}>{children}</Tag>;
}

// Counts up to `value` the first time it is visible. Non-numeric values render as they are.
export function CountUp({ value, duration = 900, format = (n) => Math.round(n).toLocaleString('en-IN'), className }) {
  const [ref, seen] = useInView('0px');
  const target = Number(value);
  const numeric = Number.isFinite(target);
  const [n, setN] = useState(reducedMotion() ? target : 0);
  useEffect(() => {
    if (!numeric || !seen) return undefined;
    if (reducedMotion()) { setN(target); return undefined; }
    let raf; const t0 = performance.now(); const from = 0;
    const tick = (t) => { const p = Math.min(1, (t - t0) / duration); setN(from + (target - from) * (1 - (1 - p) ** 3)); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, target, numeric, duration]);
  return <span ref={ref} className={className}>{numeric ? format(n) : (value ?? '—')}</span>;
}

// Circular score gauge. The arc animates from empty to `value` (0-100) after mount.
export function Ring({ value = 0, size = 64, stroke = 6, label, sub, tone }) {
  const [on, setOn] = useState(reducedMotion());
  useEffect(() => { const id = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(id); }, []);
  const r = (size - stroke) / 2; const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const t = tone || (v >= 70 ? 'hi' : v >= 45 ? 'mid' : 'lo');
  return (
    <span className={`ring ${t}`} style={{ width: size, height: size }} role="img" aria-label={`${label ?? v}${sub ? ` ${sub}` : ''}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
        <circle className="ring-arc" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={on ? c * (1 - v / 100) : c} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span className="ring-text"><b>{label ?? v}</b>{sub && <small>{sub}</small>}</span>
    </span>
  );
}

// Liquid-chrome HackElite emblem with cobalt/cyan orbits. Decorative.
export function Emblem({ size = 280, className = '', parallax = false }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!parallax || reducedMotion() || !ref.current) return undefined;
    const el = ref.current; let raf = 0;
    const move = (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth - 0.5) * 2; const y = (e.clientY / window.innerHeight - 0.5) * 2;
        el.style.setProperty('--px', x.toFixed(3)); el.style.setProperty('--py', y.toFixed(3));
      });
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => { window.removeEventListener('pointermove', move); cancelAnimationFrame(raf); };
  }, [parallax]);
  return (
    <div ref={ref} className={`emb ${className}`} style={{ '--s': `${size}px` }} aria-hidden="true">
      <span className="emb-glow" />
      <span className="emb-orbit o1"><i /></span>
      <span className="emb-orbit o2"><i /></span>
      <span className="emb-blob" />
      <svg className="emb-a" viewBox="0 0 120 120" focusable="false">
        <defs>
          <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F4F7FB" /><stop offset=".22" stopColor="#9FC0FF" /><stop offset=".42" stopColor="#0C1E52" />
            <stop offset=".55" stopColor="#22C8FF" /><stop offset=".78" stopColor="#F4F7FB" /><stop offset="1" stopColor="#145BFF" />
          </linearGradient>
          <linearGradient id="chrome2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#C6FF00" /><stop offset=".5" stopColor="#22C8FF" /><stop offset="1" stopColor="#145BFF" /></linearGradient>
        </defs>
        <path d="M60 10 14 108h24l22-52 22 52h24L60 10Z" fill="url(#chrome)" />
        <path d="M60 58 46 90h28L60 58Z" fill="url(#chrome2)" />
        <path d="M60 10 38 62" stroke="#fff" strokeOpacity=".7" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  );
}

// Initials avatar whose gradient comes from the HackElite palette (hashed from the name so it is stable).
const AV = [['#145BFF', '#22C8FF'], ['#22C8FF', '#C6FF00'], ['#145BFF', '#0B2A78'], ['#C6FF00', '#22C8FF'], ['#0B2A78', '#22C8FF'], ['#145BFF', '#C6FF00']];
export const hueOf = (s = '') => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % AV.length;
export function Avatar({ name = '?', size = 40, ring, className = '' }) {
  const [a, b] = AV[hueOf(name)];
  const ini = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const dark = hueOf(name) === 1 || hueOf(name) === 3;
  return <span className={`av ${ring ? 'ring-on' : ''} ${className}`} style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, ${a}, ${b})`, color: dark ? '#0a1400' : '#fff' }} aria-hidden="true">{ini}</span>;
}

// Smooth line/area chart. `points` = [{label, value}]. The line draws itself in; hover/focus shows a value tooltip.
export function LineChart({ points = [], height = 180, unit = '' }) {
  const [ref, seen] = useInView('0px');
  const [hover, setHover] = useState(null);
  const W = 600; const H = height; const pad = 28;
  if (points.length < 2) return <div className="chart-empty muted small">Not enough data yet.</div>;
  const max = Math.max(...points.map((p) => p.value), 1);
  const x = (i) => pad + (i * (W - pad * 2)) / (points.length - 1);
  const y = (v) => H - pad - (v / max) * (H - pad * 2);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${d} L${x(points.length - 1)},${H - pad} L${x(0)},${H - pad} Z`;
  const h = hover != null ? points[hover] : null;
  return (
    <div className="chart" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Trend chart" onPointerLeave={() => setHover(null)}>
        <defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#145BFF" stopOpacity=".45" /><stop offset="1" stopColor="#145BFF" stopOpacity="0" /></linearGradient></defs>
        {[0.25, 0.5, 0.75, 1].map((g) => <line key={g} className="grid-l" x1={pad} x2={W - pad} y1={H - pad - g * (H - pad * 2)} y2={H - pad - g * (H - pad * 2)} />)}
        <path d={area} fill="url(#ar)" className={`area ${seen ? 'in' : ''}`} />
        <path d={d} className={`line ${seen ? 'in' : ''}`} pathLength="1" fill="none" />
        {points.map((p, i) => (
          <g key={p.label + i}>
            <rect x={x(i) - 14} y={0} width={28} height={H} fill="transparent" tabIndex={0} onPointerEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} aria-label={`${p.label}: ${p.value}${unit}`} />
            <circle cx={x(i)} cy={y(p.value)} r={hover === i ? 6 : 3.5} className="dot" />
          </g>
        ))}
        {h && <line className="cursor" x1={x(hover)} x2={x(hover)} y1={pad / 2} y2={H - pad} />}
      </svg>
      <div className="chart-x">{points.map((p) => <span key={p.label}>{p.label}</span>)}</div>
      {h && <div className="chart-tip" style={{ left: `${(x(hover) / W) * 100}%` }}><b>{h.value.toLocaleString('en-IN')}{unit}</b><span>{h.label}</span></div>}
    </div>
  );
}

// One consistent stroke-icon set (replaces platform emoji, whose colours vary by OS and can drift off-palette).
const PATHS = {
  people: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20c0-3 2.5-5 6-5s6 2 6 5M16 11a2.5 2.5 0 1 0 0-5M17 15c2.4.3 4 2 4 5',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2ZM10 20a2 2 0 0 0 4 0',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  calendar: 'M5 5h14v15H5zM5 10h14M9 3v4M15 3v4',
  doc: 'M7 3h7l4 4v14H7zM14 3v4h4M9.5 12h5M9.5 16h5',
  hourglass: 'M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9',
  hash: 'M9 4 7 20M17 4l-2 16M4 9h16M3 15h16',
};
export function Icon({ name, size = '1.05em', className = '' }) {
  return <svg className={`ico ${className}`} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ verticalAlign: '-0.15em', flex: 'none' }}><path d={PATHS[name]} /></svg>;
}

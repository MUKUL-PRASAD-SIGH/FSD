/**
 * UIEffects — attaches delegated pointer effects once for the whole app:
 *  • click ripple on .btn
 *  • subtle 3D tilt + glare on cards/panels (fine pointers only)
 * No React re-renders; works for elements added later.
 */
const TILT_SEL = '.opportunity-card, .glass-panel, .glass-panel-glow';
const MAX_TILT = 5; // degrees — deliberately subtle

export function initUIEffects() {
  if (window.__fxInit) return;
  window.__fxInit = true;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (reduced) return;

  // Ripple
  document.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest?.('.btn');
    if (!btn || btn.disabled) return;
    const r = btn.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2;
    const dot = document.createElement('span');
    dot.className = 'fx-ripple';
    dot.style.width = dot.style.height = `${size}px`;
    dot.style.left = `${e.clientX - r.left - size / 2}px`;
    dot.style.top = `${e.clientY - r.top - size / 2}px`;
    btn.appendChild(dot);
    dot.addEventListener('animationend', () => dot.remove());
  });

  if (!fine) return;

  // Tilt (skip large panels where tilt would feel wrong)
  let active = null;
  const reset = (el) => {
    el.classList.add('fx-tilt-leave');
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--glare', '0');
  };

  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest?.(TILT_SEL);
    if (active && active !== el) { reset(active); active = null; }
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width > 760 || r.height > 640) return;
    const pos = getComputedStyle(el).position;
    if (pos === 'fixed' || pos === 'absolute' || pos === 'sticky') return; // don't disturb overlays
    if (pos === 'static') el.style.position = 'relative'; // glare layer needs a positioned parent
    active = el;
    el.classList.add('fx-tilt');
    el.classList.remove('fx-tilt-leave');
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--ry', `${((px - 0.5) * 2 * MAX_TILT).toFixed(2)}deg`);
    el.style.setProperty('--rx', `${(-(py - 0.5) * 2 * MAX_TILT).toFixed(2)}deg`);
    el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
    el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
    el.style.setProperty('--glare', '1');
  }, { passive: true });
}

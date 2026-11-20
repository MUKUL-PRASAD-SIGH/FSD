import { useEffect, useId, useRef, useState } from 'react';
import { api } from './api.js';

// Searchable college field. Suggestions come from the shared directory (Bengaluru colleges seeded, plus every college
// other users added). Typing a name that is not listed is fine: it is added when the profile is saved, and shows up in
// this dropdown for the next person.
export default function CollegePicker({ value, onChange, label = 'College / institute', autoFocus = false }) {
  const [q, setQ] = useState(value || '');
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const id = useId();
  const box = useRef(null);

  useEffect(() => { setQ(value || ''); }, [value]);
  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => api.colleges(q).then((r) => setRows(r.colleges)).catch(() => setRows([])), 150);
    return () => clearTimeout(t);
  }, [q, open]);
  useEffect(() => {
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const typed = q.trim();
  const exact = rows.some((c) => c.name.toLowerCase() === typed.toLowerCase());
  const options = [...rows.map((c) => ({ name: c.name, hint: c.source === 'user' ? 'added by students' : c.city })), ...(typed.length >= 3 && !exact ? [{ name: typed, add: true }] : [])];
  const pick = (o) => { setQ(o.name); onChange(o.name); setOpen(false); setActive(-1); };
  const onKey = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) { setOpen(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter' && open && active >= 0) { e.preventDefault(); pick(options[active]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="combo" ref={box}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id} value={q} autoFocus={autoFocus} autoComplete="off" maxLength={140} placeholder="Start typing, e.g. RVCE, PES, Christ…"
        role="combobox" aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
        onFocus={() => setOpen(true)} onKeyDown={onKey}
        onChange={(e) => { setQ(e.target.value); onChange(e.target.value); setOpen(true); setActive(-1); }}
      />
      {open && options.length > 0 && (
        <ul className="combo-list" id={`${id}-list`} role="listbox">
          {options.map((o, i) => (
            <li key={`${o.name}-${o.add ? 'add' : 'row'}`} id={`${id}-${i}`} role="option" aria-selected={i === active} className={`${i === active ? 'on' : ''} ${o.add ? 'add' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }}>
              {o.add ? <>➕ Add “{o.name}” — my college isn’t listed</> : <>{o.name}{o.hint && <span className="muted small"> · {o.hint}</span>}</>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

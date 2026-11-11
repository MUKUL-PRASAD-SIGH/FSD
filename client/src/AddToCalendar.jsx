import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from './api.js';
import { useAuth } from './auth.jsx';
import { useToast } from './toast.jsx';

// "Add to calendar" for one listing: Google / Outlook links (no download needed) and an .ics file.
// Signed in, the .ics carries your own reminders and tracker status; the generic file is the fallback.
export default function AddToCalendar({ listing, label = '📅 Add to calendar' }) {
  const { user } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState(null);
  const [busy, setBusy] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  async function toggle() {
    const next = !open; setOpen(next);
    if (next && !links) { try { setLinks(await api.calendarLinks(listing.id)); } catch { setLinks({}); } }
  }
  async function download() {
    if (!user) { window.location.href = `/api/listings/calendar.ics?ids=${listing.id}`; return; }
    setBusy(true);
    try {
      const { blob, filename } = await api.eventIcs(listing.id);
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: filename });
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      toast('Calendar file downloaded with your reminders', 'good');
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); setOpen(false); }
  }

  const item = (href, text) => <a role="menuitem" className="cal-item" href={href} target="_blank" rel="noreferrer noopener" onClick={() => setOpen(false)}>{text}</a>;
  return (
    <span className="cal" ref={box} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="btn ghost" aria-haspopup="menu" aria-expanded={open} onClick={toggle}>{label}</button>
      {open && (
        <div className="cal-menu" role="menu">
          {!links && <span className="cal-item muted">Loading…</span>}
          {links?.deadline && (
            <>
              <p className="cal-head">Deadline reminder</p>
              {item(links.deadline.google, 'Google Calendar')}
              {item(links.deadline.outlook, 'Outlook.com')}
              {item(links.deadline.office365, 'Microsoft 365')}
            </>
          )}
          {links?.event && (
            <>
              <p className="cal-head">Event dates</p>
              {item(links.event.google, 'Google Calendar')}
              {item(links.event.outlook, 'Outlook.com')}
            </>
          )}
          <p className="cal-head">Apple Calendar and others</p>
          <button type="button" role="menuitem" className="cal-item" onClick={download} disabled={busy}>{busy ? 'Preparing…' : `Download .ics${user ? ' (your reminders)' : ''}`}</button>
          {user ? <Link role="menuitem" className="cal-item" to="/tracker#calendar" onClick={() => setOpen(false)}>Sync all my events live →</Link> : <Link role="menuitem" className="cal-item" to="/login">Sign in for personal reminders →</Link>}
        </div>
      )}
    </span>
  );
}

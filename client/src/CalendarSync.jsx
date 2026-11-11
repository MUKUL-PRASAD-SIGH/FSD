import { useEffect, useState } from 'react';
import { api } from './api.js';
import { useToast } from './toast.jsx';

const REMINDER_LABEL = { 15: '15 minutes', 60: '1 hour', 180: '3 hours', 1440: '1 day', 4320: '3 days', 10080: '1 week' };

// Live, personal calendar feed. Add it once to Google / Apple / Outlook and everything in your tracker (and, if you want,
// your top picks) stays in your calendar by itself, with the reminders you choose. The link is a secret: revoke it any time.
export default function CalendarSync() {
  const toast = useToast();
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.calendarSettings().then(setS).catch((e) => toast(e.message, 'err'));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(fn, ok) { setBusy(true); try { await fn(); if (ok) toast(ok, 'good'); await load(); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); } }
  const toggleReminder = (m) => {
    const has = s.reminders.includes(m);
    const next = has ? s.reminders.filter((x) => x !== m) : [...s.reminders, m];
    if (!next.length || next.length > 3) return;
    setS({ ...s, reminders: next });
    run(() => api.calendarUpdate({ reminders: next }));
  };
  const copy = async () => { try { await navigator.clipboard.writeText(s.feedUrl); toast('Calendar link copied', 'good'); } catch { toast('Select the link and copy it manually', 'err'); } };

  if (!s) return null;
  return (
    <section className="panel cal-sync" id="calendar" aria-label="Calendar sync">
      <div className="studio-head">
        <h2>Your calendar {s.enabled && <span className="pill okp">● Live</span>}</h2>
        {s.enabled && <span className="muted small">{s.counts.tracked} tracked event{s.counts.tracked === 1 ? '' : 's'}{s.includePicks ? ` · ${s.counts.picks} pick${s.counts.picks === 1 ? '' : 's'}` : ''} in your feed</span>}
      </div>
      {!s.enabled ? (
        <>
          <p className="muted">Keep every hackathon you track in your own calendar automatically: deadlines and event dates, with reminders you choose, updated when organisers change something.</p>
          <button className="btn primary" disabled={busy} onClick={() => run(() => api.calendarCreateToken(), 'Calendar sync is on')}>Turn on calendar sync</button>
        </>
      ) : (
        <>
          <div className="row">
            <a className="btn" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(s.webcalUrl)}`} target="_blank" rel="noreferrer noopener">Add to Google Calendar</a>
            <a className="btn" href={s.webcalUrl}>Apple Calendar</a>
            <a className="btn" href={`https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(s.feedUrl)}&name=HackElite`} target="_blank" rel="noreferrer noopener">Outlook</a>
          </div>
          {!s.reachableByGoogle && <p className="small warn">This server is running locally, so Google and Outlook on the web can’t reach the link yet. Apple Calendar and desktop Outlook on this computer can. Once the site is deployed with a public address it works everywhere.</p>}
          <label>Calendar link (any app: “subscribe from URL”)
            <span className="row"><input readOnly value={s.feedUrl} onFocus={(e) => e.target.select()} style={{ flex: 1, minWidth: 0 }} /><button type="button" className="btn" onClick={copy}>Copy</button></span>
          </label>
          <fieldset>
            <legend>Remind me before each deadline (up to 3)</legend>
            <div className="chips">
              {s.allowedReminders.map((m) => <button key={m} type="button" className={`chip ${s.reminders.includes(m) ? 'on' : ''}`} aria-pressed={s.reminders.includes(m)} onClick={() => toggleReminder(m)} disabled={busy}>{REMINDER_LABEL[m]}</button>)}
            </div>
          </fieldset>
          <label className="chk"><input type="checkbox" checked={s.includePicks} disabled={busy} onChange={(e) => run(() => api.calendarUpdate({ includePicks: e.target.checked }))} /> Also add my top recommended hackathons (matching my profile)</label>
          <p className="small muted">🔒 Anyone with this link can see your calendar, so keep it private. Notes are never included. Google refreshes subscribed calendars every several hours.</p>
          <div className="row">
            <button className="link small" disabled={busy} onClick={() => { if (window.confirm('Create a new link? The current one stops working everywhere.')) run(() => api.calendarCreateToken(), 'New link created. Re-add it in your calendar app.'); }}>Generate a new link</button>
            <button className="link small" disabled={busy} onClick={() => { if (window.confirm('Turn off calendar sync? The link stops working.')) run(() => api.calendarRevoke(), 'Calendar sync turned off'); }}>Turn off</button>
          </div>
        </>
      )}
    </section>
  );
}

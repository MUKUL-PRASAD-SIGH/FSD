// Calendar integration: RFC 5545 (iCalendar) output, "add to Google/Outlook" links, and the per-user feed.
//
// What is personal to a user:
//   - which events appear: their tracker (saved / applied / shortlisted / won) and, if they opt in, their top picks
//   - how early they are reminded (user.calendar.reminders, minutes before)
//   - their status per event ("Your status: applied") in each description
// The live feed is addressed by a secret token (a "capability URL", like Google's secret iCal address). It is
// revocable, rotates on regenerate, is never returned by any other endpoint, and carries no notes or contact data.
const { config } = require('../config/env');

const ALLOWED_REMINDERS = [15, 60, 180, 1440, 4320, 10080]; // 15 min, 1 h, 3 h, 1 day, 3 days, 1 week
const DEFAULT_REMINDERS = [1440];

// ---------------------------------------------------------------- iCalendar primitives
const pad = (n) => String(n).padStart(2, '0');
// UTC basic format: 20261114T043000Z
const utc = (d) => { const x = new Date(d); return `${x.getUTCFullYear()}${pad(x.getUTCMonth() + 1)}${pad(x.getUTCDate())}T${pad(x.getUTCHours())}${pad(x.getUTCMinutes())}${pad(x.getUTCSeconds())}Z`; };

// TEXT escaping per RFC 5545 §3.3.11
const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Content lines are limited to 75 OCTETS; continuation lines start with one space. Never split a UTF-8 character.
function fold(line) {
  const buf = Buffer.from(line, 'utf8');
  if (buf.length <= 75) return line;
  const out = []; let start = 0; let limit = 75;
  while (start < buf.length) {
    let end = Math.min(start + limit, buf.length);
    while (end < buf.length && (buf[end] & 0xc0) === 0x80) end--; // back up to a character boundary
    out.push(buf.slice(start, end).toString('utf8'));
    start = end; limit = 74; // continuation lines carry a leading space
  }
  return out.join('\r\n ');
}

const alarm = (minutes, text) => ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(text)}`, `TRIGGER:-PT${Math.round(minutes)}M`, 'END:VALARM'];
const label = (m) => (m >= 10080 ? `${m / 10080} week` : m >= 1440 ? `${m / 1440} day${m >= 2880 ? 's' : ''}` : m >= 60 ? `${m / 60} hour${m >= 120 ? 's' : ''}` : `${m} minutes`);

const cleanReminders = (arr) => {
  const picked = [...new Set((Array.isArray(arr) ? arr : []).map(Number).filter((m) => ALLOWED_REMINDERS.includes(m)))].sort((a, b) => b - a).slice(0, 3);
  return picked.length ? picked : DEFAULT_REMINDERS;
};

// ---------------------------------------------------------------- listing -> events
const money = (l) => (l.prizeLabel && !/^(see (listing|page)|not stated|n\/a)$/i.test(l.prizeLabel) ? l.prizeLabel : null);
const where = (l) => (l.mode === 'ONLINE' ? 'Online' : [l.venue, l.city, l.state, l.country].filter(Boolean).join(', ') || String(l.mode || '').toLowerCase());
const pageUrl = (l) => `${String(config.appUrl).replace(/\/$/, '')}/listing/${l._id}`;

function describe(l, { status, pick } = {}) {
  return [
    pick != null ? `Recommended for you (${pick}% match).` : null,
    status ? `Your status: ${status}.` : null,
    `${l.organiser ? l.organiser + ' · ' : ''}${l.platform}`,
    money(l) && `Prize: ${money(l)}`,
    l.fee && `Entry: ${l.fee}`,
    l.teamMax ? `Team size: ${l.teamMin || 1}–${l.teamMax}` : null,
    `Register: ${l.url}`,
    `Details and Q&A: ${pageUrl(l)}`,
  ].filter(Boolean).join('\n');
}

// A listing becomes up to two events: the registration/submission deadline, and the event itself when its dates are known.
function eventsFor(l, { reminders = DEFAULT_REMINDERS, status, pick, now = new Date() } = {}) {
  const out = [];
  const seq = Math.floor(new Date(l.updatedAt || l.createdAt || now).getTime() / 1000); // bumps whenever the listing changes
  const stamp = utc(l.updatedAt || now);
  const common = (uid, summary, start, end, extra = []) => [
    'BEGIN:VEVENT', `UID:${uid}@hackelite`, `DTSTAMP:${utc(now)}`, `LAST-MODIFIED:${stamp}`, `SEQUENCE:${seq}`,
    `DTSTART:${utc(start)}`, `DTEND:${utc(end)}`, `SUMMARY:${esc(summary)}`, `DESCRIPTION:${esc(describe(l, { status, pick }))}`,
    `LOCATION:${esc(where(l))}`, `URL:${l.url}`, 'TRANSP:TRANSPARENT', ...extra,
  ];
  const kind = { registration: 'Registration closes', submission: 'Submissions close', event_start: 'Register before it starts', event_end: 'Ends' }[l.deadlineKind] || 'Deadline';
  const dl = new Date(l.deadline);
  if (dl > now) {
    out.push([
      ...common(`deadline-${l._id}`, `⏰ ${kind}: ${l.title}`, dl, new Date(dl.getTime() + 30 * 60000), pick != null ? ['CATEGORIES:HackElite pick'] : ['CATEGORIES:HackElite deadline']),
      ...reminders.flatMap((m) => alarm(m, `${label(m)} until: ${l.title}`)), 'END:VEVENT',
    ]);
  }
  const start = l.startDate ? new Date(l.startDate) : null;
  const end = l.endDate ? new Date(l.endDate) : null;
  if (start && !isNaN(start) && (end || start) > now && Math.abs(start - dl) > 60000) {
    const e = end && !isNaN(end) && end > start ? end : new Date(start.getTime() + 3 * 3600000);
    out.push([...common(`event-${l._id}`, l.title, start, e, ['CATEGORIES:HackElite event']), ...reminders.slice(0, 2).flatMap((m) => alarm(m, `${label(m)} until it starts: ${l.title}`)), 'END:VEVENT']);
  }
  return out;
}

function buildCalendar({ name, description, events, refreshMinutes = 60 }) {
  const head = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HackElite//Calendar 2.0//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(name)}`, description ? `X-WR-CALDESC:${esc(description)}` : null, 'X-WR-TIMEZONE:UTC',
    `REFRESH-INTERVAL;VALUE=DURATION:PT${refreshMinutes}M`, `X-PUBLISHED-TTL:PT${refreshMinutes}M`,
  ].filter(Boolean);
  return [...head, ...events.flat(), 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------- "add to calendar" links (no auth, no .ics needed)
const trunc = (s, n) => String(s || '').slice(0, n);
function links(l) {
  const dl = new Date(l.deadline);
  const dEnd = new Date(dl.getTime() + 30 * 60000);
  const desc = describe(l);
  const loc = where(l);
  const google = (title, a, b) => `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(trunc(title, 200))}&dates=${utc(a)}/${utc(b)}&details=${encodeURIComponent(trunc(desc, 1500))}&location=${encodeURIComponent(trunc(loc, 200))}`;
  const outlook = (base, title, a, b) => `${base}/calendar/0/deeplink/compose?path=%2Fcalendar%2Faction%2Fcompose&rrv=addevent&subject=${encodeURIComponent(trunc(title, 200))}&startdt=${encodeURIComponent(new Date(a).toISOString())}&enddt=${encodeURIComponent(new Date(b).toISOString())}&body=${encodeURIComponent(trunc(desc, 1500))}&location=${encodeURIComponent(trunc(loc, 200))}`;
  const kind = { registration: 'Registration closes', submission: 'Submissions close' }[l.deadlineKind] || 'Deadline';
  const dTitle = `⏰ ${kind}: ${l.title}`;
  const out = {
    deadline: {
      title: dTitle, google: google(dTitle, dl, dEnd),
      outlook: outlook('https://outlook.live.com', dTitle, dl, dEnd), office365: outlook('https://outlook.office.com', dTitle, dl, dEnd),
    },
  };
  const s = l.startDate ? new Date(l.startDate) : null;
  const e = l.endDate ? new Date(l.endDate) : null;
  if (s && !isNaN(s) && s > new Date()) {
    const end = e && !isNaN(e) && e > s ? e : new Date(s.getTime() + 3 * 3600000);
    out.event = { title: l.title, google: google(l.title, s, end), outlook: outlook('https://outlook.live.com', l.title, s, end), office365: outlook('https://outlook.office.com', l.title, s, end) };
  }
  return out;
}

module.exports = { ALLOWED_REMINDERS, DEFAULT_REMINDERS, cleanReminders, buildCalendar, eventsFor, links, fold, esc, utc };

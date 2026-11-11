import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from './api.js';
import { useAuth } from './auth.jsx';
import { useToast } from './toast.jsx';

// Privacy and notification switches. Each change saves immediately.
export default function SocialSettings() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [headline, setHeadline] = useState(user.social?.headline || '');
  const verified = user.emailVerified;

  async function save(patch, ok = 'Saved') {
    try { const r = await api.updateProfile(patch); setUser(r.user); toast(ok, 'good'); } catch (e) { toast(e.message, 'err'); }
  }
  const s = user.social || {};
  const n = user.notify || {};
  return (
    <section className="panel" aria-label="Network and notifications">
      <h2>Network &amp; notifications</h2>
      <fieldset>
        <legend>Who can find you</legend>
        <label className="chk"><input type="checkbox" checked={!!s.discoverable} onChange={(e) => save({ social: { discoverable: e.target.checked } })} /> Let teammates find me by name (shows your name, headline and skills; never your email)</label>
        <label className="chk"><input type="checkbox" checked={!!s.lookingForTeam} disabled={!s.discoverable} onChange={(e) => save({ social: { lookingForTeam: e.target.checked } })} /> I’m looking for a team</label>
        <label>Headline <span className="muted small">(optional, e.g. “React dev · loves design systems”)</span>
          <span className="row"><input value={headline} maxLength={120} onChange={(e) => setHeadline(e.target.value)} style={{ flex: 1, minWidth: 200 }} /><button type="button" className="btn" onClick={() => save({ social: { headline } })}>Save</button></span>
        </label>
        {user.plan?.tier === 'pro' && s.discoverable && <p className="small muted">Pro: you also appear in other Pro members’ teammate suggestions.</p>}
      </fieldset>
      <fieldset>
        <legend>Email me</legend>
        <label className="chk"><input type="checkbox" checked={!!n.emailReminders} disabled={!verified} onChange={(e) => save({ notify: { emailReminders: e.target.checked } })} /> Before the deadline of hackathons in my tracker (timing is set in <Link to="/tracker#calendar">calendar reminders</Link>, default 1 day)</label>
        <label className="chk"><input type="checkbox" checked={n.emailSocial !== false} disabled={!verified} onChange={(e) => save({ notify: { emailSocial: e.target.checked } })} /> When someone sends me a connection request or a team / room invitation</label>
        {!verified && <p className="small warn" style={{ color: 'var(--warm)' }}>Verify your email address first (use the banner at the top). We only email verified addresses.</p>}
        <p className="small muted">In-app notifications always arrive instantly while you’re online.</p>
      </fieldset>
    </section>
  );
}

import { useState } from 'react';
import { api } from './api.js';
import { useAuth } from './auth.jsx';
import { useToast } from './toast.jsx';

// SMS / WhatsApp deadline reminders. Shown only when the server has Twilio configured (cfg.smsChannels).
// The number is only saved after the person types the one-time code we send to it.
export default function PhoneReminders() {
  const { user, setUser, cfg } = useAuth();
  const toast = useToast();
  const channels = cfg.smsChannels || [];
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState(channels.includes('whatsapp') && !channels.includes('sms') ? 'whatsapp' : 'sms');
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  if (!channels.length) return null;
  const run = async (fn) => { setBusy(true); try { await fn(); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); } };

  if (user.phone?.verified) {
    return (
      <fieldset><legend>Text reminders</legend>
        <p className="small">📱 {user.phone.number} · {user.phone.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} ✓ verified</p>
        <label className="chk"><input type="checkbox" checked={!!user.notify?.smsReminders} disabled={busy}
          onChange={(e) => run(async () => { const r = await api.updateProfile({ notify: { smsReminders: e.target.checked } }); setUser(r.user); })} /> text me 1 day (and 3 hours, if picked in calendar reminders) before tracked deadlines</label>
        <p className="small muted">At most a few texts a day. Reply STOP to any message to turn them off.</p>
        <button type="button" className="link small" disabled={busy} onClick={() => run(async () => { const r = await api.phoneRemove(); setUser(r.user); toast('Phone number removed', 'good'); })}>Remove my number</button>
      </fieldset>
    );
  }
  return (
    <fieldset><legend>Text reminders</legend>
      <p className="small muted">Get a text before deadlines in your tracker. We only use your number for reminders and never show it to anyone.</p>
      {!sentTo ? (
        <div className="row">
          <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" aria-label="Mobile number" maxLength={20} />
          {channels.length > 1 && <select value={channel} onChange={(e) => setChannel(e.target.value)} aria-label="Send by">{channels.map((c) => <option key={c} value={c}>{c === 'whatsapp' ? 'WhatsApp' : 'SMS'}</option>)}</select>}
          <button type="button" className="btn ghost" disabled={busy || phone.replace(/\D/g, '').length < 10} onClick={() => run(async () => { const r = await api.phoneStart(phone, channel); setSentTo(r.sentTo); })}>Send code</button>
        </div>
      ) : (
        <div className="row">
          <span className="small">Code sent to {sentTo}</span>
          <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" aria-label="Verification code" maxLength={10} />
          <button type="button" className="btn primary" disabled={busy || code.length < 4} onClick={() => run(async () => { const r = await api.phoneVerify(code); setUser(r.user); toast('Number verified. Text reminders are on.', 'good'); })}>Verify</button>
          <button type="button" className="link small" onClick={() => { setSentTo(''); setCode(''); }}>change number</button>
        </div>
      )}
    </fieldset>
  );
}

// Reminders before the deadline of hackathons in a user's tracker, by email and/or SMS / WhatsApp.
//   - opt-in per channel: notify.emailReminders (VERIFIED email) and notify.smsReminders (VERIFIED phone)
//   - email lead times come from the user's calendar reminder settings (15 min .. 1 week; default 1 day)
//   - SMS costs money, so it only goes out at 1 day and/or 3 hours before (whichever of those the user picked; 1 day if
//     neither), and at most SMS_DAILY_CAP_PER_USER texts per person per day
//   - idempotent: ReminderLog is unique per (user, listing, lead time, channel), so a restart or overlapping run never
//     double-sends
//   - a reminder is only sent shortly after its scheduled moment (GRACE), so tracking an event late does not fire a stale
//     "7 days to go" message
const User = require('../models/User');
const Saved = require('../models/Saved');
const ReminderLog = require('../models/ReminderLog');
const { sendMail } = require('./mailer');
const sms = require('./sms');
const cal = require('./calendar');
const { config } = require('../config/env');

const GRACE_MS = 3 * 3600 * 1000;
const SMS_LEADS = [1440, 180];
const abs = (p) => `${String(config.appUrl).replace(/\/$/, '')}${p}`;
const lead = (m) => (m >= 10080 ? `${m / 10080} week` : m >= 1440 ? `${m / 1440} day${m >= 2880 ? 's' : ''}` : m >= 60 ? `${m / 60} hour${m >= 120 ? 's' : ''}` : `${m} minutes`);
const clip = (s, n) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s));

const wantsEmail = (u) => !!(u.notify?.emailReminders && u.emailVerified);
const wantsSms = (u) => !!(u.notify?.smsReminders && u.phone?.verifiedAt && u.phone?.number);
const smsLeads = (reminders) => { const picked = SMS_LEADS.filter((m) => reminders.includes(m)); return picked.length ? picked : [1440]; };

// Claim a (user, listing, lead, channel) slot; false if it was already sent
async function claim(user, l, minutes, channel) {
  try { await ReminderLog.create({ user: user._id, listing: l._id, minutes, channel }); return true; } catch (e) { if (e.code === 11000) return false; throw e; }
}

async function remindUser(user, now) {
  const reminders = cal.cleanReminders(user.calendar?.reminders);
  const email = wantsEmail(user);
  const text = wantsSms(user);
  if (!email && !text) return 0;
  const textLeads = text ? smsLeads(reminders) : [];
  const horizon = new Date(now.getTime() + Math.max(...reminders, ...textLeads) * 60000);
  const rows = await Saved.find({ user: user._id, status: { $in: ['saved', 'applied', 'shortlisted'] } })
    .populate({ path: 'listing', match: { status: 'published', deadline: { $gt: now, $lte: horizon } } }).lean();
  let textsToday = text ? await ReminderLog.countDocuments({ user: user._id, channel: { $in: ['sms', 'whatsapp'] }, sentAt: { $gte: new Date(now.getTime() - 86400000) } }) : 0;
  const due = (dl, m) => { const at = dl - m * 60000; return now.getTime() >= at && now.getTime() - at <= GRACE_MS; };
  let sent = 0;
  for (const row of rows) {
    const l = row.listing; if (!l) continue;
    const dl = new Date(l.deadline).getTime();
    if (email) {
      for (const m of reminders) {
        if (!due(dl, m) || !(await claim(user, l, m, 'email'))) continue;
        const status = row.status === 'applied' ? 'You are marked as applied.' : row.status === 'shortlisted' ? 'You are shortlisted.' : 'It is saved in your tracker.';
        await sendMail({
          to: user.email,
          subject: `⏰ Closes in ${lead(m)}: ${l.title}`,
          text: [`Hi ${user.name.split(' ')[0]},`, '', `${l.title} (${l.platform}) closes in about ${lead(m)}.`, status, '', `Register / details: ${l.url}`, `Your tracker: ${abs('/tracker')}`, '',
            'Turn these emails off any time in your profile (Notifications).'].join('\n'),
        });
        sent += 1;
      }
    }
    for (const m of textLeads) {
      if (textsToday >= config.twilio.dailyCap) break;
      const channel = user.phone.channel === 'whatsapp' && sms.canSend('whatsapp') ? 'whatsapp' : 'sms';
      if (!due(dl, m) || !(await claim(user, l, m, channel))) continue;
      try {
        await sms.send({ to: user.phone.number, channel, body: `HackElite: "${clip(l.title, 60)}" closes in ${lead(m)}. ${l.url} Reply STOP to stop reminders.` });
        textsToday += 1; sent += 1;
      } catch (e) {
        await ReminderLog.deleteOne({ user: user._id, listing: l._id, minutes: m, channel }).catch(() => {}); // let the next run retry
        console.warn('sms reminder failed:', e.message);
      }
    }
  }
  return sent;
}

async function runReminders({ now = new Date() } = {}) {
  const users = await User.find({
    status: 'active',
    $or: [{ emailVerified: true, 'notify.emailReminders': true }, { 'notify.smsReminders': true, 'phone.verifiedAt': { $ne: null } }],
  }).select('name email emailVerified calendar notify phone').lean();
  let sent = 0;
  for (const u of users) { try { sent += await remindUser(u, now); } catch (e) { console.warn('reminder failed for a user:', e.message); } }
  return { users: users.length, sent };
}

module.exports = { runReminders, remindUser, smsLeads };

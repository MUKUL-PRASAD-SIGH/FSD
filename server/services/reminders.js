// Email reminders before the deadline of hackathons in a user's tracker.
//   - opt-in (notify.emailReminders), sent only to a VERIFIED address, and only for events still open
//   - lead times come from the user's calendar reminder settings (15 min, 1 h, 3 h, 1 day, 3 days, 1 week; default 1 day)
//   - idempotent: ReminderLog has a unique (user, listing, lead time) so a restart or overlapping run never double-sends
//   - a reminder is only sent shortly after its scheduled moment (GRACE), so tracking an event late does not fire a stale
//     "7 days to go" message
const User = require('../models/User');
const Saved = require('../models/Saved');
const ReminderLog = require('../models/ReminderLog');
const { sendMail } = require('./mailer');
const cal = require('./calendar');
const { config } = require('../config/env');

const GRACE_MS = 3 * 3600 * 1000;
const abs = (p) => `${String(config.appUrl).replace(/\/$/, '')}${p}`;
const lead = (m) => (m >= 10080 ? `${m / 10080} week` : m >= 1440 ? `${m / 1440} day${m >= 2880 ? 's' : ''}` : m >= 60 ? `${m / 60} hour${m >= 120 ? 's' : ''}` : `${m} minutes`);

async function remindUser(user, now) {
  const reminders = cal.cleanReminders(user.calendar?.reminders);
  const horizon = new Date(now.getTime() + Math.max(...reminders) * 60000);
  const rows = await Saved.find({ user: user._id, status: { $in: ['saved', 'applied', 'shortlisted'] } })
    .populate({ path: 'listing', match: { status: 'published', deadline: { $gt: now, $lte: horizon } } }).lean();
  let sent = 0;
  for (const row of rows) {
    const l = row.listing; if (!l) continue;
    const dl = new Date(l.deadline).getTime();
    for (const m of reminders) {
      const due = dl - m * 60000;
      if (now.getTime() < due || now.getTime() - due > GRACE_MS) continue;
      try { await ReminderLog.create({ user: user._id, listing: l._id, minutes: m }); } catch (e) { if (e.code === 11000) continue; throw e; } // already sent
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
  return sent;
}

async function runReminders({ now = new Date() } = {}) {
  const users = await User.find({ status: 'active', emailVerified: true, 'notify.emailReminders': true }).select('name email calendar notify').lean();
  let sent = 0;
  for (const u of users) { try { sent += await remindUser(u, now); } catch (e) { console.warn('reminder failed for a user:', e.message); } }
  return { users: users.length, sent };
}

module.exports = { runReminders, remindUser };

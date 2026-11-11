// One place to tell a user something: stores an in-app notification, pushes it live over the socket if they are online,
// and (when they allow it, their address is verified and SMTP is configured) sends an email.
const User = require('../models/User');
const Notification = require('../models/Notification');
const realtime = require('./realtime');
const { sendMail, mailEnabled } = require('./mailer');
const { config } = require('../config/env');

const abs = (link) => `${String(config.appUrl).replace(/\/$/, '')}${link || '/'}`;

// kind: 'social' emails respect notify.emailSocial; they are only ever sent to verified addresses so nobody can be
// spammed through a typo or a made-up sign-up.
async function notify(userId, { type, title, body = '', link = '/notifications', email = true }) {
  try {
    const n = await Notification.create({ user: userId, type, title: String(title).slice(0, 200), body: String(body).slice(0, 500), link });
    realtime.emitToUser(userId, 'notification:new', { id: n._id, type, title: n.title, body: n.body, link: n.link, createdAt: n.createdAt, read: false });
    if (email && (mailEnabled() || config.isTest)) {
      const u = await User.findById(userId).select('email emailVerified notify name');
      if (u && u.emailVerified && u.notify?.emailSocial !== false) {
        sendMail({ to: u.email, subject: `HackElite: ${n.title}`, text: `${n.title}\n${n.body ? n.body + '\n' : ''}\nOpen it: ${abs(link)}\n\nYou can switch these emails off in your profile settings.` })
          .catch((e) => console.warn('notification email failed:', e.message));
      }
    }
    return n;
  } catch (e) { console.warn('notify failed:', e.message); return null; }
}

module.exports = { notify };

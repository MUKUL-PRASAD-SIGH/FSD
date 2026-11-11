// Email is optional. Set SMTP_URL (e.g. smtps://user:pass@smtp.gmail.com:465) to send real mail.
// Without it, messages are logged to the server console in development and dropped in production.
const { config } = require('../config/env');

let transport;
function getTransport() {
  if (transport !== undefined) return transport;
  if (!config.smtpUrl) return (transport = null);
  transport = require('nodemailer').createTransport(config.smtpUrl);
  return transport;
}

const outbox = []; // test builds only: every message that would have been sent

async function sendMail({ to, subject, text }) {
  if (config.isTest) { outbox.push({ to, subject, text }); return { sent: false, captured: true }; }
  const t = getTransport();
  if (!t) {
    if (!config.isProd && !config.isTest) console.log(`[mail:dev] to=${to} subject="${subject}"\n${text}\n`);
    return { sent: false };
  }
  await t.sendMail({ from: config.mailFrom, to, subject, text });
  return { sent: true };
}

const mailEnabled = () => !!config.smtpUrl;

module.exports = { sendMail, mailEnabled, outbox };

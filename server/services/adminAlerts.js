// Tell admins when something needs a human decision: a user added a college that is not in the directory, someone
// reported a listing, or listings were flagged as confusing. In-app notification for every admin, plus email to
// ADMIN_EMAILS (and admin accounts) when SMTP is configured.
// Email is capped (20 per hour per process); anything over the cap still shows in-app and in Admin → review.
const User = require('../models/User');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const { sendMail, mailEnabled } = require('./mailer');
const { config } = require('../config/env');

const HOUR = 3600000;
let window = { start: 0, sent: 0 };
const allow = () => { const now = Date.now(); if (now - window.start > HOUR) window = { start: now, sent: 0 }; if (window.sent >= 20) return false; window.sent++; return true; };
const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').slice(0, n);

async function recipients() {
  const admins = await User.find({ role: 'admin', status: 'active' }).select('_id email').lean();
  const emails = [...new Set([...config.adminEmails, ...admins.map((a) => a.email.toLowerCase())])];
  return { admins, emails };
}

async function alert({ title, body, link = '/admin', subject, text }) {
  const { admins, emails } = await recipients();
  if (admins.length) await Notification.insertMany(admins.map((a) => ({ user: a._id, type: 'admin_review', title: clip(title, 200), body: clip(body, 500), link })), { ordered: false }).catch(() => {});
  if (!emails.length || !mailEnabled() || !allow()) return { inApp: admins.length, emailed: 0 };
  await sendMail({ to: emails.join(','), subject: clip(subject || title, 150), text: `${text || body}\n\nReview it: ${config.appUrl}${link}\n\n— HackElite admin alerts` }).catch((e) => console.warn('admin alert email failed:', e.message));
  return { inApp: admins.length, emailed: emails.length };
}

const newCollege = (college, user) => alert({
  title: 'New college added by a user',
  body: `${user.name} added “${college.name}”${college.city ? ` (${college.city})` : ''}. It is already visible in the dropdown; approve, rename, merge or hide it.`,
  link: '/admin?tab=review',
  subject: `[HackElite] New college to review: ${college.name}`,
});

const REASON_LABEL = { wrong_dates: 'wrong dates', wrong_prize: 'wrong prize', wrong_location: 'wrong location', broken_link: 'broken link', duplicate: 'duplicate', spam_or_fake: 'spam or fake', closed: 'already closed', other: 'other' };
const listingReported = (listing, report, user) => alert({
  title: `Listing reported: ${REASON_LABEL[report.reason] || report.reason}`,
  body: `“${listing.title}” (${listing.platform}) — ${REASON_LABEL[report.reason]}${report.note ? `: ${report.note}` : ''}. Reported by ${user.name}.`,
  link: '/admin?tab=review',
  subject: `[HackElite] Listing reported (${REASON_LABEL[report.reason]}): ${listing.title}`,
  text: `“${listing.title}” on ${listing.platform} was reported as: ${REASON_LABEL[report.reason]}.\n${report.note ? `Note: ${report.note}\n` : ''}Listing: ${listing.url}\nReported by: ${user.name} <${user.email}>`,
});

// After each ingest: at most one digest a day, and only if something new needs review
async function qualityDigest({ flagged, changed }) {
  if (!flagged || !changed) return { sent: false };
  const last = await AuditLog.findOne({ action: 'admin.quality_digest' }).sort({ createdAt: -1 }).lean();
  if (last && Date.now() - new Date(last.createdAt).getTime() < 22 * HOUR) return { sent: false };
  const Listing = require('../models/Listing');
  const worst = await Listing.find({ status: 'published', deadline: { $gte: new Date() }, 'quality.score': { $gte: 2 }, 'quality.reviewedAt': null })
    .sort({ 'quality.score': -1 }).limit(10).select('title platform quality').lean();
  if (!worst.length) return { sent: false };
  const { adminNotes } = require('./listingQuality');
  const lines = worst.map((l, i) => `${i + 1}. ${l.title} (${l.platform}): ${adminNotes(l.quality.issues).map((x) => x.note).join('; ')}`);
  await alert({
    title: `${flagged} listings need a look`,
    body: `${flagged} open listings have confusing or missing details. Top: ${worst.slice(0, 3).map((l) => l.title).join(', ')}.`,
    link: '/admin?tab=review',
    subject: `[HackElite] ${flagged} listings need review`,
    text: `${flagged} open listings have confusing or missing details. The ten most serious:\n\n${lines.join('\n')}`,
  });
  await AuditLog.create({ action: 'admin.quality_digest', meta: { flagged } }).catch(() => {});
  return { sent: true };
}

module.exports = { alert, newCollege, listingReported, qualityDigest };

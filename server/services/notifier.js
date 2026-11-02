// Generates in-app (and optional email) notifications after each ingest / manual listing:
//   new_match : a listing created since the user's last run that scores >= their threshold (Pro uses the rubric, Free uses basic picks)
//   deadline  : a saved/applied listing closing within 48 hours
// Idempotent: the unique (user, listing, type) index means reruns never duplicate.
const User = require('../models/User');
const Listing = require('../models/Listing');
const Saved = require('../models/Saved');
const Notification = require('../models/Notification');
const { recommend } = require('./recommender');
const { sendMail, mailEnabled } = require('./mailer');
const { config } = require('../config/env');

const MAX_PER_RUN = 5;

async function insertMany(docs) {
  if (!docs.length) return 0;
  try {
    const r = await Notification.insertMany(docs, { ordered: false });
    return r.length;
  } catch (e) {
    return e.insertedDocs?.length || e.result?.insertedCount || 0; // duplicates are expected and fine
  }
}

async function runForUser(user, now = new Date()) {
  const created = [];
  const since = user.notify?.lastRunAt || new Date(now.getTime() - 86400000);
  const fresh = await Listing.find({ status: 'published', createdAt: { $gt: since }, deadline: { $gte: now } }).lean();
  if (fresh.length) {
    const full = await User.findById(user._id).select('+resume.text');
    const ranked = recommend(full, fresh, { limit: MAX_PER_RUN, tier: full.isPro() ? 'pro' : 'free', now })
      .filter((r) => r.score >= (user.notify?.minMatch ?? 55));
    created.push(...ranked.map((r) => ({
      user: user._id, type: 'new_match', listing: r.listing._id, score: r.score,
      title: `${r.score}% match: ${r.listing.title}`, body: r.reasons.slice(0, 2).join(' · '), link: '/for-you',
    })));
  }
  const soon = new Date(now.getTime() + 48 * 3600000);
  const saved = await Saved.find({ user: user._id, status: { $in: ['saved', 'applied'] } }).populate({ path: 'listing', match: { deadline: { $gte: now, $lte: soon } } }).lean();
  for (const s of saved) {
    if (!s.listing) continue;
    created.push({ user: user._id, type: 'deadline', listing: s.listing._id, title: `Closing soon: ${s.listing.title}`, body: `Deadline ${new Date(s.listing.deadline).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`, link: '/tracker' });
  }
  const n = await insertMany(user.notify?.inApp === false ? [] : created);
  await User.updateOne({ _id: user._id }, { $set: { 'notify.lastRunAt': now } });

  if (n && user.notify?.email && mailEnabled()) {
    const lines = created.slice(0, 8).map((c) => `• ${c.title}${c.body ? ' — ' + c.body : ''}`).join('\n');
    await sendMail({ to: user.email, subject: `${n} new opportunit${n === 1 ? 'y' : 'ies'} for you`, text: `${lines}\n\nOpen HackElite: ${config.appUrl}/for-you` }).catch((e) => console.error('digest failed', e.message));
  }
  return n;
}

async function runNotifier() {
  const users = await User.find({ status: 'active', role: { $in: ['user', 'lister', 'admin'] } }).select('notify role plan email').lean(false).cursor();
  let total = 0;
  for await (const u of users) total += await runForUser(u).catch((e) => { console.error('notify user failed', e.message); return 0; });
  return total;
}

module.exports = { runNotifier, runForUser };

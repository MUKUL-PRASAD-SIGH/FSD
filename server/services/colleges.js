// College directory: search for the dropdown, resolve what a user typed to one canonical college, and let users add a
// missing one. Additions are visible immediately and queued for admin review (services/adminAlerts.js emails a digest).
const College = require('../models/College');
const { esc } = require('../utils/sanitize');

// "R.V. College of Engg., Bangalore" and "rv college of engineering" should be the same college
const key = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/\(.*?\)/g, ' ')
  .replace(/&/g, ' and ')
  .replace(/\bengg\b\.?/g, 'engineering').replace(/\binst\b\.?/g, 'institute').replace(/\btech\b\.?/g, 'technology')
  .replace(/\b(bengaluru|bangalore|blr)\b/g, ' ')
  .replace(/\b(the|of|and|at|in)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim().replace(/\s+/g, ' ')
  // initials: "r v college" (from "R.V.") and "rv college" are the same
  .replace(/\b(?:[a-z] )+[a-z]\b/g, (m) => m.replace(/ /g, ''));

const clean = (s) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 140);

// Reject obvious junk before it reaches the shared dropdown
function validName(name) {
  if (name.length < 3 || name.length > 140) return 'College name should be 3 to 140 characters';
  if (!/[a-z]{3}/i.test(name)) return 'Enter the college name in letters';
  if (/https?:|www\.|@|\.(com|in|org|net)\b/i.test(name)) return 'Enter just the college name, not a link or email';
  return null;
}

let seeded = false;
async function seed() {
  if (seeded) return 0;
  const rows = require('../data/colleges-bengaluru');
  const ops = rows.map(([name, aliases]) => ({
    updateOne: {
      filter: { key: key(name) },
      update: { $setOnInsert: { name, key: key(name), aliases, aliasKeys: aliases.map(key), city: 'Bengaluru', source: 'seed', reviewed: true } },
      upsert: true,
    },
  }));
  const r = await College.bulkWrite(ops, { ordered: false });
  seeded = true;
  return r.upsertedCount || 0;
}

async function search(q, { limit = 12 } = {}) {
  const term = clean(q).slice(0, 60);
  const lim = Math.min(30, Math.max(1, Number(limit) || 12));
  if (!term) return College.find({ hidden: false }).sort({ users: -1, name: 1 }).limit(lim).select('name city source').lean();
  const re = new RegExp(esc(term), 'i');
  const k = key(term);
  const or = [{ name: re }, { aliases: re }];
  if (k) or.push({ key: new RegExp(esc(k)) }, { aliasKeys: new RegExp(`^${esc(k)}`) });
  const rows = await College.find({ hidden: false, $or: or }).sort({ users: -1, name: 1 }).limit(lim * 2).select('name city source aliases').lean();
  // exact/prefix matches first
  const lower = term.toLowerCase();
  const rank = (c) => (c.name.toLowerCase().startsWith(lower) || c.aliases?.some((a) => a.toLowerCase() === lower) ? 0 : 1);
  return rows.sort((a, b) => rank(a) - rank(b)).slice(0, lim).map(({ aliases, ...c }) => c);
}

// What a user typed -> the canonical college name. Adds a new college if there is no match.
// Returns { name, college, created } or { error }.
async function resolve(input, user) {
  const name = clean(input);
  if (!name) return { name: '' };
  const k = key(name);
  if (!k) return { error: 'Enter the college name in letters' };
  let c = await College.findOne({ $or: [{ key: k }, { aliasKeys: k }] });
  if (c && c.hidden) return { error: 'That college name was removed by an admin. Pick one from the list, or type the full official name.' };
  if (c) return { name: c.name, college: c, created: false };
  const bad = validName(name);
  if (bad) return { error: bad };
  // a person can add at most 3 new colleges a day (keeps the shared list clean)
  if (user?._id) {
    const today = await College.countDocuments({ addedBy: user._id, createdAt: { $gte: new Date(Date.now() - 86400000) } });
    if (today >= 3) return { error: 'You have added several colleges today. Pick one from the list or try again tomorrow.' };
  }
  try {
    c = await College.create({ name, key: k, city: user?.location?.city || '', source: 'user', reviewed: false, addedBy: user?._id || null });
  } catch (e) {
    if (e.code === 11000) { c = await College.findOne({ key: k }); return { name: c.name, college: c, created: false }; }
    throw e;
  }
  return { name: c.name, college: c, created: true };
}

// Keep the dropdown ranking honest when someone switches college
async function moveUser(fromName, toCollege) {
  if (fromName) await College.updateOne({ key: key(fromName), users: { $gt: 0 } }, { $inc: { users: -1 } });
  if (toCollege) await College.updateOne({ _id: toCollege._id }, { $inc: { users: 1 } });
}

module.exports = { key, clean, validName, seed, search, resolve, moveUser };

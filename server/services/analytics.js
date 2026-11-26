// Platform analytics for the ADMIN console and the ADMIN assistant. Never imported by user-facing code (tests enforce it).
//
// Every function here is a fixed, read-only aggregation with validated arguments. Nothing builds a query from free text
// except userLookup, which escapes its input and only matches name/email. Output goes through `safe()`, which strips any
// field that could hold a credential or private content, as a second line of defence behind the explicit projections.
//
// What is never returned: password hashes, tokens of any kind, resume text, chat message text, private AI conversations.
const mongoose = require('mongoose');
const User = require('../models/User');
const Listing = require('../models/Listing');
const Saved = require('../models/Saved');
const Message = require('../models/Message');
const Room = require('../models/Room');
const Connection = require('../models/Connection');
const Team = require('../models/Team');
const Activity = require('../models/Activity');
const UsageDay = require('../models/UsageDay');
const { esc } = require('../utils/sanitize');

const SAFE_USER = 'name email role status plan.tier emailVerified college location.city education.level skills createdAt privacy.shareUsage';
const FORBIDDEN = /pass|token|hash|secret|resume|otp|cookie|embedding|googleid/i;

const clampInt = (v, lo, hi, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const since = (days) => new Date(Date.now() - days * 86400000);
const dayKey = (d) => d.toISOString().slice(0, 10);
const mins = (s) => Math.round((s || 0) / 6) / 10; // seconds -> minutes, 1 decimal

function safe(v) {
  if (Array.isArray(v)) return v.map(safe);
  if (v instanceof Date || v instanceof mongoose.Types.ObjectId) return v;
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) if (!FORBIDDEN.test(k)) out[k] = safe(x);
    return out;
  }
  return v;
}

const userView = (u) => u && ({
  id: String(u._id), name: u.name, email: u.email, role: u.role, status: u.status, plan: u.plan?.tier || 'free',
  verified: !!u.emailVerified, college: u.college || '', city: u.location?.city || '', education: u.education?.level || '',
  skills: (u.skills || []).slice(0, 8), joined: u.createdAt, tracksUsage: u.privacy?.shareUsage !== false,
});
const listingView = (l) => l && ({ id: String(l._id), title: l.title, platform: l.platform, source: l.source, type: l.type, mode: l.mode, city: l.city || '', deadline: l.deadline, status: l.status });

// ---------------------------------------------------------------------------------------------------------------------------
async function overview({ days } = {}) {
  days = clampInt(days, 1, 365, 30);
  const from = since(days);
  const today = dayKey(new Date());
  const [users, newUsers, pro, admins, openListings, usage, todayActive, events, saves, messages, connections, teams] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ createdAt: { $gte: from } }),
    User.countDocuments({ 'plan.tier': 'pro' }),
    User.countDocuments({ role: 'admin' }),
    Listing.countDocuments({ status: 'published', deadline: { $gte: new Date() } }),
    UsageDay.aggregate([{ $match: { date: { $gte: new Date(dayKey(from)) } } }, { $group: { _id: '$user', s: { $sum: '$seconds' } } }, { $group: { _id: null, users: { $sum: 1 }, s: { $sum: '$s' } } }]),
    UsageDay.countDocuments({ day: today }),
    Activity.aggregate([{ $match: { at: { $gte: from } } }, { $group: { _id: '$type', n: { $sum: 1 } } }]),
    Saved.countDocuments({ createdAt: { $gte: from } }),
    Message.countDocuments({ createdAt: { $gte: from } }),
    Connection.countDocuments({ status: 'accepted', updatedAt: { $gte: from } }),
    Team.countDocuments({ createdAt: { $gte: from } }),
  ]);
  const ev = Object.fromEntries(events.map((e) => [e._id, e.n]));
  const u = usage[0] || { users: 0, s: 0 };
  return {
    windowDays: days,
    users: { total: users, newInWindow: newUsers, pro, admins, activeInWindow: u.users, activeToday: todayActive },
    time: { totalMinutes: mins(u.s), avgMinutesPerActiveUser: u.users ? mins(u.s / u.users) : 0 },
    events: { pageViews: ev.page_view || 0, listingViews: ev.listing_view || 0, registerClicks: ev.register_click || 0, searches: ev.search || 0 },
    engagement: { savesToTracker: saves, chatMessages: messages, newConnections: connections, teamsCreated: teams },
    openListings,
  };
}

async function dailySeries({ days } = {}) {
  days = clampInt(days, 1, 90, 30);
  const from = new Date(dayKey(since(days - 1)));
  const fmt = { $dateToString: { format: '%Y-%m-%d', date: '$at' } };
  const [usage, signups, events] = await Promise.all([
    UsageDay.aggregate([{ $match: { date: { $gte: from } } }, { $group: { _id: '$day', active: { $sum: 1 }, s: { $sum: '$seconds' } } }]),
    User.aggregate([{ $match: { createdAt: { $gte: from } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } }]),
    Activity.aggregate([{ $match: { at: { $gte: from } } }, { $group: { _id: { d: fmt, t: '$type' }, n: { $sum: 1 } } }]),
  ]);
  const U = Object.fromEntries(usage.map((x) => [x._id, x]));
  const S = Object.fromEntries(signups.map((x) => [x._id, x.n]));
  const E = {};
  for (const e of events) (E[e._id.d] ||= {})[e._id.t] = e.n;
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = dayKey(new Date(from.getTime() + i * 86400000));
    out.push({ day: d, activeUsers: U[d]?.active || 0, minutes: mins(U[d]?.s), signups: S[d] || 0, pageViews: E[d]?.page_view || 0, listingViews: E[d]?.listing_view || 0, registerClicks: E[d]?.register_click || 0 });
  }
  return { days: out };
}

const METRIC = { views: 'listing_view', clicks: 'register_click' };
async function topListings({ days, metric = 'views', limit } = {}) {
  days = clampInt(days, 1, 365, 30); limit = clampInt(limit, 1, 50, 10);
  if (!['views', 'clicks', 'saves'].includes(metric)) metric = 'views';
  const from = since(days);
  const rows = metric === 'saves'
    ? await Saved.aggregate([{ $match: { createdAt: { $gte: from } } }, { $group: { _id: '$listing', n: { $sum: 1 }, people: { $addToSet: '$user' } } }, { $sort: { n: -1 } }, { $limit: limit }])
    : await Activity.aggregate([{ $match: { type: METRIC[metric], at: { $gte: from }, listing: { $ne: null } } }, { $group: { _id: '$listing', n: { $sum: 1 }, people: { $addToSet: '$user' } } }, { $sort: { n: -1 } }, { $limit: limit }]);
  const ls = await Listing.find({ _id: { $in: rows.map((r) => r._id) } }).select('title platform source type mode city deadline status').lean();
  const L = new Map(ls.map((l) => [String(l._id), l]));
  return { metric, windowDays: days, listings: rows.map((r) => ({ ...listingView(L.get(String(r._id)) || { _id: r._id, title: '(deleted listing)' }), count: r.n, uniqueUsers: r.people.filter(Boolean).length })) };
}

async function topSearches({ days, limit } = {}) {
  days = clampInt(days, 1, 365, 30); limit = clampInt(limit, 1, 50, 15);
  const rows = await Activity.aggregate([{ $match: { type: 'search', at: { $gte: since(days) } } }, { $group: { _id: '$query', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: limit }]);
  return { windowDays: days, searches: rows.map((r) => ({ query: r._id, count: r.n })) };
}

async function topPages({ days, limit } = {}) {
  days = clampInt(days, 1, 365, 30); limit = clampInt(limit, 1, 50, 10);
  const rows = await Activity.aggregate([{ $match: { type: 'page_view', at: { $gte: since(days) } } }, { $group: { _id: '$path', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: limit }]);
  return { windowDays: days, pages: rows.map((r) => ({ path: r._id || '/', views: r.n })) };
}

// Who spends the most time on the platform. Only users with privacy.shareUsage on are ever recorded.
async function timeSpent({ days, limit } = {}) {
  days = clampInt(days, 1, 365, 30); limit = clampInt(limit, 1, 50, 10);
  const rows = await UsageDay.aggregate([
    { $match: { date: { $gte: new Date(dayKey(since(days))) } } },
    { $group: { _id: '$user', s: { $sum: '$seconds' }, activeDays: { $sum: 1 }, lastSeenAt: { $max: '$lastSeenAt' } } },
    { $sort: { s: -1 } }, { $limit: limit },
  ]);
  const us = await User.find({ _id: { $in: rows.map((r) => r._id) } }).select(SAFE_USER).lean();
  const M = new Map(us.map((u) => [String(u._id), u]));
  return {
    windowDays: days,
    users: rows.map((r) => { const u = M.get(String(r._id)); return { id: String(r._id), name: u?.name || '(deleted user)', email: u?.email || '', role: u?.role || '', plan: u?.plan?.tier || '', minutes: mins(r.s), activeDays: r.activeDays, avgMinutesPerDay: mins(r.s / r.activeDays), lastSeenAt: r.lastSeenAt }; }),
  };
}

// Look a person up by name or email: profile basics + their own engagement numbers. No resume, messages or AI history.
async function userLookup({ q, days } = {}) {
  days = clampInt(days, 1, 365, 30);
  const term = String(q || '').trim().slice(0, 60);
  if (term.length < 2) return { query: term, users: [] };
  const re = new RegExp(esc(term), 'i');
  const us = await User.find({ $or: [{ name: re }, { email: re }] }).select(SAFE_USER).limit(5).lean();
  const from = since(days);
  const users = await Promise.all(us.map(async (u) => {
    const [usage, events, saved, msgs, rooms] = await Promise.all([
      UsageDay.aggregate([{ $match: { user: u._id, date: { $gte: new Date(dayKey(from)) } } }, { $group: { _id: null, s: { $sum: '$seconds' }, days: { $sum: 1 }, last: { $max: '$lastSeenAt' } } }]),
      Activity.aggregate([{ $match: { user: u._id, at: { $gte: from } } }, { $group: { _id: '$type', n: { $sum: 1 } } }]),
      Saved.aggregate([{ $match: { user: u._id } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
      Message.countDocuments({ sender: u._id, createdAt: { $gte: from } }),
      Room.countDocuments({ 'members.user': u._id }),
    ]);
    const x = usage[0] || {};
    return {
      ...userView(u),
      windowDays: days,
      usage: { minutes: mins(x.s), activeDays: x.days || 0, lastSeenAt: x.last || null },
      events: Object.fromEntries(events.map((e) => [e._id, e.n])),
      tracker: Object.fromEntries(saved.map((s) => [s._id, s.n])),
      social: { messagesSent: msgs, chatRooms: rooms },
    };
  }));
  return { query: term, users };
}

const top = (field, match = {}, limit = 8) => User.aggregate([
  { $match: { ...match, [field]: { $nin: ['', null] } } }, { $group: { _id: `$${field}`, n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: limit },
]).then((r) => r.map((x) => ({ value: x._id, count: x.n })));

async function userBreakdown() {
  const [roles, plans, statuses, verified, education, colleges, cities, skills] = await Promise.all([
    top('role'), top('plan.tier'), top('status'),
    User.countDocuments({ emailVerified: true }),
    top('education.level'), top('college'), top('location.city'),
    User.aggregate([{ $unwind: '$skills' }, { $group: { _id: { $toLower: '$skills' }, n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 12 }]).then((r) => r.map((x) => ({ value: x._id, count: x.n }))),
  ]);
  return { roles, plans, statuses, verifiedEmails: verified, education, colleges, cities, skills };
}

async function listingBreakdown({ days } = {}) {
  days = clampInt(days, 1, 365, 30);
  const open = { status: 'published', deadline: { $gte: new Date() } };
  const by = (field) => Listing.aggregate([{ $match: open }, { $group: { _id: `$${field}`, n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 12 }]).then((r) => r.map((x) => ({ value: x._id || 'unknown', count: x.n })));
  const viewsBy = (field) => Activity.aggregate([
    { $match: { type: 'listing_view', at: { $gte: since(days) } } },
    { $lookup: { from: 'listings', localField: 'listing', foreignField: '_id', as: 'l', pipeline: [{ $project: { [field]: 1 } }] } },
    { $unwind: '$l' }, { $group: { _id: `$l.${field}`, n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 12 },
  ]).then((r) => r.map((x) => ({ value: x._id || 'unknown', views: x.n })));
  const [byType, bySource, byMode, viewsByType, viewsBySource, viewsByMode] = await Promise.all([by('type'), by('source'), by('mode'), viewsBy('type'), viewsBy('source'), viewsBy('mode')]);
  return { windowDays: days, openListings: { byType, bySource, byMode }, views: { byType: viewsByType, bySource: viewsBySource, byMode: viewsByMode } };
}

// Unique signed-in people at each step: viewed a listing -> clicked Register -> saved one to their tracker.
async function funnel({ days } = {}) {
  days = clampInt(days, 1, 365, 30);
  const from = since(days);
  const uniq = (type) => Activity.distinct('user', { type, at: { $gte: from }, user: { $ne: null } }).then((r) => r.length);
  const [viewers, clickers, savers, anonViews] = await Promise.all([
    uniq('listing_view'), uniq('register_click'),
    Saved.distinct('user', { createdAt: { $gte: from } }).then((r) => r.length),
    Activity.countDocuments({ type: 'listing_view', at: { $gte: from }, user: null }),
  ]);
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  return { windowDays: days, viewers, clickers, savers, viewToClickPct: pct(clickers, viewers), viewToSavePct: pct(savers, viewers), anonymousListingViews: anonViews };
}

async function chatActivity({ days } = {}) {
  days = clampInt(days, 1, 90, 14);
  const from = since(days);
  const [perDay, rooms, activeRooms, senders] = await Promise.all([
    Message.aggregate([{ $match: { createdAt: { $gte: from } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Room.aggregate([{ $group: { _id: '$kind', n: { $sum: 1 } } }]),
    Message.distinct('room', { createdAt: { $gte: from } }).then((r) => r.length),
    Message.distinct('sender', { createdAt: { $gte: from } }).then((r) => r.length),
  ]);
  return { windowDays: days, messagesPerDay: perDay.map((d) => ({ day: d._id, messages: d.n })), roomsByKind: Object.fromEntries(rooms.map((r) => [r._id, r.n])), activeRooms, activeSenders: senders, note: 'Counts only. Message text is never read for analytics.' };
}

// Everything the dashboard tab needs, in one call
async function dashboard({ days } = {}) {
  days = clampInt(days, 1, 90, 30);
  const [ov, series, viewed, clicked, saved, searches, time, fun, pages] = await Promise.all([
    overview({ days }), dailySeries({ days }), topListings({ days, metric: 'views', limit: 10 }), topListings({ days, metric: 'clicks', limit: 10 }),
    topListings({ days, metric: 'saves', limit: 10 }), topSearches({ days, limit: 12 }), timeSpent({ days, limit: 10 }), funnel({ days }), topPages({ days, limit: 8 }),
  ]);
  return safe({ overview: ov, series: series.days, mostViewed: viewed.listings, mostClicked: clicked.listings, mostSaved: saved.listings, searches: searches.searches, timeSpent: time.users, funnel: fun, pages: pages.pages });
}

const wrap = (fn) => async (args) => safe(await fn(args || {}));
module.exports = {
  overview: wrap(overview), dailySeries: wrap(dailySeries), topListings: wrap(topListings), topSearches: wrap(topSearches), topPages: wrap(topPages),
  timeSpent: wrap(timeSpent), userLookup: wrap(userLookup), userBreakdown: wrap(userBreakdown), listingBreakdown: wrap(listingBreakdown),
  funnel: wrap(funnel), chatActivity: wrap(chatActivity), dashboard, safe, FORBIDDEN,
};

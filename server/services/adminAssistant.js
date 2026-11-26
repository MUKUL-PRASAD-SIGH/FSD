// ADMIN-ONLY analytics assistant. Reached only through /api/admin/assistant (protect + requireRole('admin')).
//
// How it answers a question:
//   1. PLAN     choose up to 3 tools from the fixed registry below (Gemini picks if configured, otherwise keyword rules)
//   2. RUN      each tool is a fixed, read-only aggregation in services/analytics.js with validated arguments
//   3. ANSWER   Gemini writes a short answer from the returned DATA only, or a templated answer without a model
// The model never writes database queries and never sees anything the tools do not return, so it cannot reach
// passwords, tokens, resumes, message text or private AI conversations: those are not in any tool's output.
const a = require('./analytics');
const { config } = require('../config/env');

const TOOLS = {
  overview: { run: a.overview, args: ['days'], about: 'Headline numbers: total/new/active users, time on platform, page and listing views, register clicks, searches, saves, chat messages, open listings.' },
  dailySeries: { run: a.dailySeries, args: ['days'], about: 'Per-day trend: active users, minutes, signups, page views, listing views, register clicks.' },
  topListings: { run: a.topListings, args: ['days', 'metric', 'limit'], about: 'Most popular hackathons/listings. metric: "views" (most viewed), "clicks" (Register clicks) or "saves" (added to trackers).' },
  topSearches: { run: a.topSearches, args: ['days', 'limit'], about: 'What people search for most.' },
  topPages: { run: a.topPages, args: ['days', 'limit'], about: 'Most visited pages of the app.' },
  timeSpent: { run: a.timeSpent, args: ['days', 'limit'], about: 'Who spends the most time on the platform: minutes, active days, last seen, per user.' },
  userLookup: { run: a.userLookup, args: ['q', 'days'], about: 'Look up one person by name or email: profile basics, time spent, views, tracker and chat counts.' },
  userBreakdown: { run: a.userBreakdown, args: [], about: 'User base composition: roles, plans, status, verified emails, education, top colleges, cities, skills.' },
  listingBreakdown: { run: a.listingBreakdown, args: ['days'], about: 'Open listings and listing views by type, source and mode (online/offline/hybrid).' },
  funnel: { run: a.funnel, args: ['days'], about: 'Conversion: unique viewers -> Register clickers -> savers.' },
  chatActivity: { run: a.chatActivity, args: ['days'], about: 'Chat usage counts: messages per day, active rooms and senders, rooms by kind. Never message text.' },
};

const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').slice(0, n);

// ---- argument hints from plain English -------------------------------------------------------------------------------------
function windowDays(q) {
  if (/\btoday\b/.test(q)) return 1;
  if (/\byesterday\b/.test(q)) return 2;
  const m = q.match(/\b(\d{1,3})\s*(day|days|d)\b/); if (m) return +m[1];
  const w = q.match(/\b(\d{1,2})\s*weeks?\b/); if (w) return +w[1] * 7;
  const mo = q.match(/\b(\d{1,2})\s*months?\b/); if (mo) return +mo[1] * 30;
  if (/\b(this|last|past)\s+week\b|\bweekly\b/.test(q)) return 7;
  if (/\b(this|last|past)\s+year\b|\byearly\b|\ball[- ]time\b/.test(q)) return 365;
  return 30;
}
const limitOf = (q) => { const m = q.match(/\btop\s+(\d{1,2})\b/) || q.match(/\b(\d{1,2})\s+(most|top|best)\b/); return m ? +m[1] : undefined; };
function lookupTerm(raw) {
  const email = raw.match(/[\w.+-]+@[\w-]+\.[\w.-]+/); if (email) return email[0];
  const quoted = raw.match(/["“']([^"”']{2,60})["”']/); if (quoted) return quoted[1];
  const named = raw.match(/\b(?:user|person|about|named|called|for|is|has|did|does|of)\s+([A-Z][\w.-]+(?:\s+[A-Z][\w.-]+)?)/); if (named) return named[1];
  return null;
}

// ---- keyword planner (no model needed) --------------------------------------------------------------------------------------
function rulePlan(raw) {
  const q = raw.toLowerCase();
  const days = windowDays(q); const limit = limitOf(q);
  const calls = [];
  const add = (tool, args = {}) => { if (calls.length < 3 && !calls.some((c) => c.tool === tool && JSON.stringify(c.args) === JSON.stringify(args))) calls.push({ tool, args }); };
  const term = lookupTerm(raw);
  if (term && /\b(who is|user|person|about|named|called|profile|details|activity of|how (much|long)( time)? (has|did|does))\b|@/.test(q)) add('userLookup', { q: term, days });
  if (/\b(time|spend|spent|spending|minutes|hours|engaged|engagement|most active|power users?|session)\b/.test(q)) add('timeSpent', { days, limit });
  if (/\b(most viewed|views?|viewed|popular|trending|hot|top (hackathons?|listings?|events?))\b/.test(q)) add('topListings', { days, metric: 'views', limit });
  if (/\b(clicks?|clicked|register(ed|ations?)?|sign[- ]?ups? to|outbound)\b/.test(q) && !/\bnew users?\b/.test(q)) add('topListings', { days, metric: 'clicks', limit });
  if (/\b(saved?|saves|tracker|bookmark|shortlist)\b/.test(q)) add('topListings', { days, metric: 'saves', limit });
  if (/\b(search(es|ed)?|look(ing)? for|keywords?|queries)\b/.test(q)) add('topSearches', { days, limit });
  if (/\b(pages?|screens?|routes?)\b/.test(q) && !/\bhackathon pages?\b/.test(q)) add('topPages', { days, limit });
  if (/\b(trend|daily|per day|each day|over time|growth|signups?|new users?|joined|registrations? of users)\b/.test(q)) add('dailySeries', { days: Math.min(days, 90) });
  if (/\b(funnel|conversion|convert|drop[- ]?off)\b/.test(q)) add('funnel', { days });
  if (/\b(chat|messages?|rooms?|dms?)\b/.test(q)) add('chatActivity', { days: Math.min(days, 90) });
  if (/\b(colleges?|universit(y|ies)|cit(y|ies)|skills?|education|demographics?|roles?|plans?|pro users?|free users?|verified|breakdown of users|user base)\b/.test(q)) add('userBreakdown');
  if (/\b(by type|by source|by mode|online|offline|hybrid|sources?|categor(y|ies)|kinds? of (hackathons?|listings?))\b/.test(q)) add('listingBreakdown', { days });
  if (!calls.length || /\b(overview|summary|summari[sz]e|how many|total|count|stats|statistics|kpis?|health of)\b/.test(q)) add('overview', { days });
  // A question about one person is answered from that person's own numbers, not the platform-wide rankings
  if (calls[0]?.tool === 'userLookup') return calls.filter((c) => !['timeSpent', 'topListings', 'overview'].includes(c.tool)).slice(0, 3);
  if (calls.some((c) => c.tool === 'funnel')) return calls.filter((c) => c.tool !== 'topListings').slice(0, 3);
  return calls.slice(0, 3);
}

// ---- Gemini (optional) ------------------------------------------------------------------------------------------------------
async function gemini(system, prompt, { json = false, maxTokens = 700 } = {}) {
  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.geminiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 }, ...(json ? { responseMimeType: 'application/json' } : {}) },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const j = await res.json();
  const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join('');
  if (!text) throw new Error('Gemini returned no text');
  return text;
}

// Anything the model proposes is re-validated: unknown tools are dropped, only declared args survive, values are clipped.
function validCalls(list) {
  const out = [];
  for (const c of Array.isArray(list) ? list : []) {
    const t = TOOLS[c?.tool];
    if (!t) continue;
    const args = {};
    for (const k of t.args) {
      const v = c.args?.[k];
      if (v == null) continue;
      if (k === 'q') args.q = clip(v, 60);
      else if (k === 'metric') { if (['views', 'clicks', 'saves'].includes(v)) args.metric = v; }
      else if (Number.isFinite(Number(v))) args[k] = Number(v);
    }
    out.push({ tool: c.tool, args });
    if (out.length === 3) break;
  }
  return out;
}

async function geminiPlan(question) {
  const catalog = Object.entries(TOOLS).map(([name, t]) => `- ${name}(${t.args.join(', ')}): ${t.about}`).join('\n');
  const system = 'You route an admin\'s analytics question to tools. Reply with JSON only: {"calls":[{"tool":"<name>","args":{...}}]} using at most 3 calls from the catalog. args: days (1-365), limit (1-50), metric ("views"|"clicks"|"saves"), q (a name or email). If nothing fits, use overview.';
  const text = await gemini(system, `TOOLS:\n${catalog}\n\nQUESTION: ${clip(question, 500)}`, { json: true, maxTokens: 300 });
  return validCalls(JSON.parse(text).calls);
}

// ---- templated answers (no model) -------------------------------------------------------------------------------------------
const n = (x) => Number(x || 0).toLocaleString('en-IN');
const list = (rows, fmt, empty) => (rows?.length ? rows.map((r, i) => `${i + 1}. ${fmt(r)}`).join('\n') : empty);
const RENDER = {
  overview: (d) => `Last ${d.windowDays} days: ${n(d.users.total)} users in total (${n(d.users.newInWindow)} new, ${n(d.users.activeInWindow)} active, ${n(d.users.activeToday)} active today, ${n(d.users.pro)} on Pro). `
    + `Time on platform: ${n(d.time.totalMinutes)} min in total, ${d.time.avgMinutesPerActiveUser} min per active user. `
    + `${n(d.events.pageViews)} page views, ${n(d.events.listingViews)} listing views, ${n(d.events.registerClicks)} Register clicks, ${n(d.events.searches)} searches. `
    + `${n(d.engagement.savesToTracker)} saves to trackers, ${n(d.engagement.chatMessages)} chat messages, ${n(d.engagement.teamsCreated)} teams created. ${n(d.openListings)} listings are open.`,
  dailySeries: (d) => { const t = d.days.reduce((s, x) => ({ a: Math.max(s.a, x.activeUsers), su: s.su + x.signups, m: s.m + x.minutes }), { a: 0, su: 0, m: 0 }); const last = d.days.slice(-7); return `Over ${d.days.length} days: ${n(t.su)} signups, ${n(Math.round(t.m))} minutes of use, peak ${n(t.a)} active users in a day.\nLast 7 days (day: active users / signups / listing views):\n${last.map((x) => `${x.day}: ${x.activeUsers} / ${x.signups} / ${x.listingViews}`).join('\n')}`; },
  topListings: (d) => `${{ views: 'Most viewed', clicks: 'Most Register clicks', saves: 'Most saved' }[d.metric]} in the last ${d.windowDays} days:\n${list(d.listings, (l) => `${l.title} (${l.platform || l.source || '—'}) — ${n(l.count)} ${d.metric}, ${n(l.uniqueUsers)} signed-in people`, 'No data yet for this window.')}`,
  topSearches: (d) => `Top searches in the last ${d.windowDays} days:\n${list(d.searches, (s) => `“${s.query}” — ${n(s.count)}`, 'No searches recorded yet.')}`,
  topPages: (d) => `Most visited pages in the last ${d.windowDays} days:\n${list(d.pages, (p) => `${p.path} — ${n(p.views)} views`, 'No page views recorded yet.')}`,
  timeSpent: (d) => `Time on platform, last ${d.windowDays} days:\n${list(d.users, (u) => `${u.name} (${u.email}) — ${u.minutes} min over ${u.activeDays} day(s), last seen ${u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString('en-IN') : 'n/a'}`, 'No usage recorded yet (time is counted while a signed-in user has the app open).')}`,
  userLookup: (d) => (d.users.length ? d.users.map((u) => `${u.name} <${u.email}> — ${u.role}, ${u.plan}, ${u.status}${u.verified ? ', verified' : ''}. Joined ${new Date(u.joined).toLocaleDateString('en-IN')}. `
    + `Last ${u.windowDays} days: ${u.usage.minutes} min over ${u.usage.activeDays} day(s), ${n(u.events.listing_view)} listing views, ${n(u.events.register_click)} Register clicks, ${n(u.social.messagesSent)} messages sent. `
    + `Tracker: ${Object.entries(u.tracker).map(([k, v]) => `${v} ${k}`).join(', ') || 'empty'}.${u.tracksUsage ? '' : ' (This user opted out of usage tracking, so time and views are not attributed to them.)'}`).join('\n') : `No user matches “${d.query}”.`),
  userBreakdown: (d) => `Users by role: ${d.roles.map((r) => `${r.value} ${r.count}`).join(', ')}. Plans: ${d.plans.map((r) => `${r.value} ${r.count}`).join(', ')}. ${n(d.verifiedEmails)} verified emails.\nTop colleges: ${d.colleges.map((c) => `${c.value} (${c.count})`).join(', ') || '—'}\nTop cities: ${d.cities.map((c) => `${c.value} (${c.count})`).join(', ') || '—'}\nTop skills: ${d.skills.map((c) => `${c.value} (${c.count})`).join(', ') || '—'}`,
  listingBreakdown: (d) => `Open listings by type: ${d.openListings.byType.map((x) => `${x.value} ${x.count}`).join(', ')}. By mode: ${d.openListings.byMode.map((x) => `${x.value} ${x.count}`).join(', ')}.\nListing views by source (last ${d.windowDays} days): ${d.views.bySource.map((x) => `${x.value} ${x.views}`).join(', ') || 'none yet'}`,
  funnel: (d) => `Last ${d.windowDays} days: ${n(d.viewers)} people viewed a listing, ${n(d.clickers)} clicked Register (${d.viewToClickPct}%), ${n(d.savers)} saved one (${d.viewToSavePct}%). Plus ${n(d.anonymousListingViews)} listing views from signed-out or opted-out visitors.`,
  chatActivity: (d) => `Chat, last ${d.windowDays} days: ${n(d.messagesPerDay.reduce((s, x) => s + x.messages, 0))} messages from ${n(d.activeSenders)} people in ${n(d.activeRooms)} rooms. Rooms by kind: ${Object.entries(d.roomsByKind).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}. ${d.note}`,
};

async function answer(question, history = []) {
  let calls = []; let planner = 'rules';
  if (config.geminiKey) { try { calls = await geminiPlan(question); planner = 'gemini'; } catch (e) { console.warn(`admin assistant: Gemini plan failed (${e.message}); using rules`); } }
  if (!calls.length) { calls = rulePlan(question); planner = 'rules'; }

  const results = [];
  for (const c of calls) results.push({ ...c, data: await TOOLS[c.tool].run(c.args) });

  let text; let mode = 'template';
  if (config.geminiKey) {
    try {
      const system = 'You are the HackElite admin analytics assistant. Answer the admin\'s question using ONLY the DATA (JSON from fixed analytics queries). Quote numbers exactly; never invent or extrapolate. If the DATA does not answer it, say which data is missing. Short, clear, use a list for rankings. Max 220 words.';
      const prompt = `DATA:\n${JSON.stringify(results.map((r) => ({ tool: r.tool, args: r.args, data: r.data }))).slice(0, 24000)}\n\nCONVERSATION SO FAR:\n${history.map((h) => `${h.role}: ${clip(h.text, 300)}`).join('\n')}\n\nQUESTION: ${clip(question, 500)}`;
      text = await gemini(system, prompt); mode = 'gemini';
    } catch (e) { console.warn(`admin assistant: Gemini answer failed (${e.message}); using template`); }
  }
  if (!text) text = results.map((r) => RENDER[r.tool](r.data)).join('\n\n');
  return { answer: text, mode, planner, tools: results.map((r) => ({ tool: r.tool, args: r.args })), data: results.map((r) => ({ tool: r.tool, data: r.data })) };
}

module.exports = { answer, rulePlan, validCalls, TOOLS };

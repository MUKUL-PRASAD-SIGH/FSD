// Guardrail for the USER-facing AI (Pro assistant /api/assistant/chat and the per-event agent /api/listings/:id/ask).
//
// The real boundary is structural: those services only ever receive public listing data and the asking user's OWN profile,
// and they never import the analytics, admin or activity code (tests/ai-guard.test.js enforces this). There is nothing
// about other users or the platform for them to leak.
//
// This check is the second layer: requests for other people's data, platform statistics, internals or credentials are
// refused up front with a clear message, before any retrieval or model call, so the model is never even asked.
// Hackathons are often ABOUT databases, APIs and security, so topic words alone ("Is there a database track?", "Do I need an
// OpenAI API key?") are fine. A rule fires only when the request points at THIS platform, its systems or other people.
const OWNER = String.raw`(your|its|hackelite['’]?s?|the (platform|site|app|server|admin|system)['’]?s?|this (platform|site|app)['’]?s?|admin|server|system|internal|backend|other users?['’]?s?|users['’]|someone['’]?s|another user['’]?s?)`;
const RULES = [
  ['credentials', new RegExp(String.raw`\b${OWNER} (passwords?|password hash(es)?|api[ _-]?keys?|secret( keys?)?|jwt( secret)?|tokens?|credentials?|env(ironment)? variables?|\.env)\b|\bpassword hash(es)?\b|\bjwt secret\b|\.env file\b`, 'i')],
  ['internals', new RegExp(String.raw`\b${OWNER} (database|db|mongo(db)?|collections?|tables?|schema|server logs?|logs?|source code)\b|\b(dump|export|query) (the |your |all )?(db|database|users?|collections?)\b|\baudit logs?\b`, 'i')],
  ['admin', /\b(admin(istrator)? (panel|dashboard|console|data|stats|analytics)|platform (analytics|stats|statistics|metrics|data)|site (analytics|traffic|metrics)|analytics (data|dashboard)|telemetry|usage (data|stats|statistics|logs?))\b/i],
  ['other-users', /\b(other|all|every|existing|most active) (users|accounts)\b|\b(users?|people)['’]?s? (emails?|e-mail addresses|phone( numbers)?|resumes?|cvs?|messages?|chats?|passwords?|personal data|activity|browsing|history|profiles?)\b/i],
  ['other-users', /\b(who (else )?(is|are) (using|signed up (on|to|for)|registered (on|with)|active on) (the |this )?(platform|site|app|hackelite))\b|\b(list|show|give|tell)( me)? (all |the )?(users|accounts|members|people (on|using) (the |this )?(platform|site|app|hackelite))\b/i],
  ['other-users', /\b(email|e-mail|phone( number)?|resume|address|messages?) of (another|other|some|a) (user|person|member)\b|\btime (spent|spend) (by|on the platform)\b|\bwho (viewed|visited|saved|clicked)\b|\bhow many (users|people|accounts) (are|use|on|signed up|registered (on|with))\b.*\b(platform|site|app|hackelite)\b/i],
  ['injection', /\b(system prompt|ignore (all |any |the )?(previous|above|prior|earlier) (instructions|rules)|reveal (your|the) (rules|instructions|prompt)|developer mode|jailbreak|act as (an? )?admin|pretend (you are|to be) (an? )?admin)\b/i],
];

const REFUSAL = 'I can only help with hackathons, events and your own profile. I can’t share anything about other users, platform statistics or HackElite’s internal systems.';

function check(question) {
  const q = String(question || '');
  for (const [reason, re] of RULES) if (re.test(q)) return { blocked: true, reason, message: REFUSAL };
  return { blocked: false };
}

module.exports = { check, REFUSAL };

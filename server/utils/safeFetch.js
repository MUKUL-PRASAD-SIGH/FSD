// SSRF-safe HTTP(S) fetch for crawling a single event page on demand.
// The URL came from third-party data (or a lister), so it is treated as hostile:
//   - http/https only, no credentials, standard ports only
//   - the hostname is resolved by US and every address must be public (loopback, private, link-local, CGNAT, cloud
//     metadata and IPv6 equivalents are refused); the connection is then pinned to that address, which defeats DNS rebinding
//   - redirects are followed manually (max 4) and every hop is re-validated
//   - hard caps on time and bytes; only text-like content types are accepted
const http = require('http');
const https = require('https');
const dns = require('dns');
const net = require('net');
const { URL } = require('url');

const MAX_BYTES = 1.5 * 1024 * 1024;
const TIMEOUT_MS = 12000;
const MAX_REDIRECTS = 4;
const UA = 'HackEliteBot/1.0 (answers questions about one event page when a signed-in user asks)';

class FetchError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

function ipv4ToInt(ip) { return ip.split('.').reduce((a, o) => (a << 8) + Number(o), 0) >>> 0; }
const V4_BLOCKS = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
].map(([base, bits]) => ({ base: ipv4ToInt(base), mask: bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0 }));

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) { const n = ipv4ToInt(ip); return V4_BLOCKS.some((b) => (n & b.mask) >>> 0 === b.base); }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    const mapped = l.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/); // IPv4-mapped
    if (mapped) return isPrivateIp(mapped[1]);
    const hex = l.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) { const a = parseInt(hex[1], 16); const b = parseInt(hex[2], 16); return isPrivateIp(`${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`); }
    return l === '::' || l === '::1' || /^f[cd]/.test(l) || /^fe[89ab]/.test(l) || /^ff/.test(l) || l.startsWith('64:ff9b') || l.startsWith('2001:db8');
  }
  return true; // not an IP at all
}

// Test-only: ALLOW_PRIVATE_FETCH="127.0.0.1,..." exempts those exact hosts so a test can crawl its own fake site. Ignored outside NODE_ENV=test.
const hostAllowed = (h) => process.env.NODE_ENV === 'test' && String(process.env.ALLOW_PRIVATE_FETCH || '').split(',').map((x) => x.trim()).filter(Boolean).includes(h);

function validateUrl(raw) {
  let u;
  try { u = new URL(String(raw)); } catch { throw new FetchError('Invalid URL', 'bad_url'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new FetchError('Only http(s) pages can be read', 'bad_url');
  if (u.username || u.password) throw new FetchError('URLs with credentials are not allowed', 'bad_url');
  if (!hostAllowed(u.hostname) && u.port && !['80', '443'].includes(u.port)) throw new FetchError('Unusual ports are not allowed', 'bad_url');
  if (!hostAllowed(u.hostname) && (u.hostname === 'localhost' || u.hostname.endsWith('.localhost') || u.hostname.endsWith('.internal') || u.hostname.endsWith('.local'))) throw new FetchError('That host is not public', 'blocked');
  return u;
}

// dns.lookup replacement used by the socket: resolves, rejects non-public answers, hands back the vetted address
function guardedLookup(hostname, options, cb) {
  dns.lookup(hostname, { all: true, verbatim: true }, (err, addrs) => {
    if (err) return cb(err);
    const bad = !hostAllowed(hostname) && addrs.some((a) => isPrivateIp(a.address));
    if (bad || !addrs.length) return cb(new FetchError('That host resolves to a non-public address', 'blocked'));
    if (options && options.all) return cb(null, addrs);
    return cb(null, addrs[0].address, addrs[0].family);
  });
}

function once(u, { accept, maxBytes }) {
  return new Promise((resolve, reject) => {
    if (net.isIP(u.hostname.replace(/^\[|\]$/g, '')) && !hostAllowed(u.hostname) && isPrivateIp(u.hostname.replace(/^\[|\]$/g, ''))) return reject(new FetchError('That host is not public', 'blocked'));
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(u, {
      method: 'GET', lookup: guardedLookup, timeout: TIMEOUT_MS,
      headers: { 'User-Agent': UA, Accept: accept, 'Accept-Encoding': 'identity', 'Accept-Language': 'en' },
    }, (res) => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location) { res.resume(); return resolve({ redirect: new URL(res.headers.location, u).toString() }); }
      const type = String(res.headers['content-type'] || '').toLowerCase();
      if (status >= 200 && status < 300 && !/(text\/|application\/(xhtml|json|ld\+json|xml))/.test(type)) { res.destroy(); return reject(new FetchError('That link is not a readable web page', 'type')); }
      const chunks = []; let size = 0;
      res.on('data', (c) => { size += c.length; if (size > maxBytes) { res.destroy(); resolve({ status, type, body: Buffer.concat(chunks).toString('utf8'), truncated: true }); } else chunks.push(c); });
      res.on('end', () => resolve({ status, type, body: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new FetchError('The page took too long to respond', 'timeout')));
    req.on('error', (e) => reject(e instanceof FetchError ? e : new FetchError(e.code === 'ENOTFOUND' ? 'That site could not be found' : `Could not reach the page (${e.code || e.message})`, 'network')));
    req.end();
  });
}

async function safeGet(raw, { accept = 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', maxBytes = MAX_BYTES } = {}) {
  let url = validateUrl(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const r = await once(url, { accept, maxBytes });
    if (r.redirect) { url = validateUrl(r.redirect); continue; }
    return { ...r, finalUrl: url.toString() };
  }
  throw new FetchError('Too many redirects', 'redirects');
}

// Minimal robots.txt: groups for our agent or "*"; longest matching Allow/Disallow wins. Unreachable/4xx robots = allowed.
function robotsAllows(robotsText, path) {
  const groups = []; let cur = null;
  for (const raw of String(robotsText || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const k = m[1].toLowerCase(); const v = m[2].trim();
    if (k === 'user-agent') { if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(v.toLowerCase()); }
    else if ((k === 'allow' || k === 'disallow') && cur) cur.rules.push({ allow: k === 'allow', path: v });
  }
  const mine = groups.filter((g) => g.agents.some((a) => a === 'hackelitebot')); const star = groups.filter((g) => g.agents.includes('*'));
  const rules = (mine.length ? mine : star).flatMap((g) => g.rules).filter((r) => r.path);
  let best = null;
  for (const r of rules) {
    const pat = r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$');
    if (new RegExp(`^${pat}`).test(path) && (!best || r.path.length >= best.path.length)) best = r;
  }
  return best ? best.allow : true;
}

// Parsed robots.txt for an origin: { allows(path), crawlDelayMs }. Cached 1 h per origin. Unreachable/4xx robots = allowed.
const robotsCache = new Map();
function crawlDelayOf(robotsText) {
  let inMine = false; let inStar = false; let mine = null; let star = null;
  for (const raw of String(robotsText || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const k = m[1].toLowerCase(); const v = m[2].trim().toLowerCase();
    if (k === 'user-agent') { inMine = v === 'hackelitebot'; inStar = v === '*'; }
    else if (k === 'crawl-delay') { const n = Number(v); if (Number.isFinite(n) && n >= 0) { if (inMine) mine = n; else if (inStar) star = n; } }
  }
  return (mine ?? star ?? 0) * 1000;
}
async function robotsFor(raw) {
  const u = validateUrl(raw);
  const hit = robotsCache.get(u.origin);
  if (hit && hit.exp > Date.now()) return hit.v;
  let v = { text: '', allows: () => true, crawlDelayMs: 0 };
  try {
    const r = await safeGet(`${u.origin}/robots.txt`, { accept: 'text/plain,*/*;q=0.5', maxBytes: 200 * 1024 });
    if (r.status >= 200 && r.status < 300) v = { text: r.body, allows: (path) => robotsAllows(r.body, path), crawlDelayMs: crawlDelayOf(r.body) };
  } catch { /* unreachable robots.txt: allowed */ }
  robotsCache.set(u.origin, { v, exp: Date.now() + 3600 * 1000 });
  return v;
}

async function allowedByRobots(raw) {
  try {
    const u = validateUrl(raw);
    const r = await safeGet(`${u.origin}/robots.txt`, { accept: 'text/plain,*/*;q=0.5', maxBytes: 200 * 1024 });
    if (r.status >= 200 && r.status < 300) return robotsAllows(r.body, u.pathname + u.search);
    return true;
  } catch { return true; }
}

module.exports = { safeGet, validateUrl, isPrivateIp, robotsAllows, allowedByRobots, robotsFor, crawlDelayOf, FetchError, UA };

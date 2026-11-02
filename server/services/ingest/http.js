// HTTP for source adapters: timeouts, retries with exponential backoff on network errors / 429 / 5xx,
// Retry-After support, a polite per-host delay, and a per-run page tracker so the runner can report
// whether pagination actually reached the end.
const UA = 'Mozilla/5.0 (compatible; HackEliteBot/3.0; +https://github.com/mukundgaur06/FSD_PROJ)';
const lastHit = new Map(); // host -> timestamp of last request
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class HttpError extends Error {
  constructor(message, status, url) { super(message); this.status = status; this.url = url; }
}

const opts = {
  minGapMs: Number(process.env.INGEST_MIN_GAP_MS ?? 400), // politeness delay between calls to one host
  retries: Number(process.env.INGEST_RETRIES ?? 3),
  timeoutMs: Number(process.env.INGEST_TIMEOUT_MS ?? 20000),
  baseBackoffMs: 1000,
};

async function politeWait(host) {
  const gap = Date.now() - (lastHit.get(host) || 0);
  if (gap < opts.minGapMs) await sleep(opts.minGapMs - gap);
  lastHit.set(host, Date.now());
}

function retryAfterMs(res) {
  const v = res.headers.get('retry-after');
  if (!v) return null;
  const s = Number(v);
  if (!isNaN(s)) return Math.min(60000, s * 1000);
  const d = Date.parse(v);
  return isNaN(d) ? null : Math.min(60000, Math.max(0, d - Date.now()));
}

// Returns the Response body as json or text. Throws HttpError after retries are exhausted.
async function request(url, { method = 'GET', body, headers = {}, as = 'json', retries = opts.retries, fetchImpl = globalThis.fetch } = {}) {
  const host = new URL(url).host;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    await politeWait(host);
    let res;
    try {
      res = await fetchImpl(url, {
        method,
        body: body == null ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
        headers: {
          'User-Agent': UA,
          Accept: as === 'json' ? 'application/json' : 'text/html,application/xhtml+xml',
          ...(body != null && typeof body !== 'string' ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        signal: AbortSignal.timeout(opts.timeoutMs),
      });
    } catch (e) {
      lastErr = new HttpError(`${host}: ${e.cause?.code || e.name || 'network error'} ${e.message}`.trim(), 0, url);
      if (attempt < retries) { await sleep(opts.baseBackoffMs * 2 ** attempt); continue; }
      throw lastErr;
    }
    if (res.ok) {
      if (as === 'json') {
        const text = await res.text();
        try { return JSON.parse(text); } catch { throw new HttpError(`${host}: response was not JSON`, res.status, url); }
      }
      return res.text();
    }
    lastErr = new HttpError(`${host} responded ${res.status}`, res.status, url);
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= retries) throw lastErr;
    await sleep(retryAfterMs(res) ?? opts.baseBackoffMs * 2 ** attempt);
  }
  throw lastErr;
}

const getJson = (url, o = {}) => request(url, { ...o, as: 'json' });
const getText = (url, o = {}) => request(url, { ...o, as: 'text' });

// Tracks pagination per adapter run. Adapters call `page()` for every page they fetch and `done(true)` when
// the source said there are no more pages (or `expected(n)` when the source reports a page count).
function pageTracker() {
  const t = { fetched: 0, expected: null, complete: false, capped: false };
  Object.defineProperty(t, '_passes', { value: 0, writable: true, enumerable: false });
  return {
    page() { t.fetched++; },
    // multi-pass adapters (several categories) report each pass; expected pages add up
    expected(n) { if (Number.isFinite(n) && n >= 0) t.expected = (t._passes++ ? t.expected : 0) + n; },
    done(complete = true) { t.complete = !!complete; },
    hitCap() { t.capped = true; t.complete = false; },
    snapshot() { return { ...t, complete: !t.capped && (t.complete || (t.expected != null && t.fetched >= t.expected)) }; },
  };
}

// Generic page loop. fetchPage(n) -> { items, totalPages?, hasMore? }. Records progress on `pages`; on failure
// the error carries `.partial` (records collected so far) so the runner can keep them and report "partial".
async function paginate(pages, { start = 1, maxPages = 100 } = {}, fetchPage) {
  const out = [];
  for (let p = start; ; p++) {
    if (p - start >= maxPages) { pages?.hitCap(); break; }
    let r;
    try { r = await fetchPage(p); } catch (e) { e.partial = out; throw e; }
    pages?.page();
    const items = r?.items || [];
    out.push(...items);
    if (r?.totalPages != null && p === start) pages?.expected(r.totalPages); // totalPages is a count
    const more = r?.hasMore ?? (r?.totalPages != null ? p - start + 1 < r.totalPages : items.length > 0);
    if (!more) { pages?.done(true); break; }
  }
  return out;
}

module.exports = { paginate, request, getJson, getText, pageTracker, HttpError, UA, _opts: opts, sleep };

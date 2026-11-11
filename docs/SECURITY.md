# Security

Every control below is either covered by an automated test (✅ test) or is configuration/design noted as such. The suite is `server/tests/e2e.test.js`.

## Controls

| Area | Control | Where | Verified |
|---|---|---|---|
| **Passwords** | ≥ 10 chars, upper+lower, digit, symbol; rejects passwords found in known breaches (see below); max 128; **bcrypt cost 12** | `utils/password.js`, `models/User.js` | ✅ test |
| **Brute force** | 5 failures → 15-min lock (even correct password refused); auth endpoints limited to 30 / 15 min / IP | `routes/auth.js`, `middleware/security.js` | ✅ test (lockout, 429) |
| **Account enumeration** | identical login error for unknown vs wrong password; dummy bcrypt for unknown emails; `forgot` always answers the same | `routes/auth.js` | ✅ test |
| **Sessions** | JWT HS256, 7 d, algorithm pinned; carries `tokenVersion` → password change, "sign out everywhere", disable and role change revoke all tokens at once | `middleware/auth.js` | ✅ test |
| **Authorisation** | server-side `requireRole`, `requirePro`, `requireApprovedLister`; ownership checks on listings; admins can't disable/demote themselves; last admin can't be deleted | `middleware/auth.js`, routes | ✅ test (escalation, ownership, gating) |
| **Mass assignment** | profile update whitelists fields; `role`, `plan`, `lister.approvalStatus`, `tokenVersion` are never client-writable; sign-up can only choose `user`/`lister` | `routes/me.js`, `routes/auth.js` | ✅ test |
| **Admin bootstrap** | admin exists only from server env (`ADMIN_EMAIL/PASSWORD`, password-policy checked) | `server.js` | ✅ test |
| **Google** | server verifies ID token signature/expiry/issuer/audience and `email_verified`; never trusts client-supplied email | `services/google.js` | ✅ test (mocked verifier) ⚠️ not yet run against real Google |
| **Reset flow** | 256-bit random token, only its SHA-256 stored, 30-min expiry, single use, resets lockout | `routes/auth.js` | ✅ test |
| **Injection** | `$`-key / dotted-key / `__proto__` stripping on body, query and params; regex input escaped (no ReDoS/regex injection); strict Mongoose schemas | `utils/sanitize.js` | ✅ test |
| **Transport headers** | helmet (CSP `default-src 'none'`, nosniff, frame-ancestors none, HSTS in prod), `x-powered-by` removed | `middleware/security.js` | ✅ test |
| **CORS** | allowlist from `CLIENT_ORIGIN`; no wildcard (startup fails in prod if `*`) | `middleware/security.js`, `config/env.js` | ✅ test |
| **DoS / abuse** | global 300/min, heavy endpoints (resume, assistant) 20/min, 200 KB JSON cap, 5 MB upload cap, 500-char questions | `middleware/security.js`, `routes/*` | ✅ test (413, 429) |
| **Uploads** | extension allowlist **and** magic-byte check (fake `.pdf` rejected); parsed in memory, never written to disk; filename sanitised | `routes/me.js` | ✅ test |
| **Secrets** | `.env` git-ignored; startup validates `JWT_SECRET` ≥ 32 chars and rejects the old project's public default; prod requires Pro keys; Pro key compare is constant-time | `config/env.js`, `routes/plan.js` | ✅ test (Pro key) |
| **Error handling** | no stack traces or internals returned; 5xx logged server-side only | `utils/http.js` | ✅ test |
| **Audit** | register, login, lockout, Google link, password change/reset, plan changes, lister decisions, listing create/update/delete, user changes, account deletion | `services/audit.js`, `models/AuditLog.js` | ✅ test |
| **Privacy** | vectors, resume text and hashes never serialised to clients; account deletion removes user, saved items and notifications and unpublishes listings; resume data removable separately | `utils/serialize.js`, `routes/auth.js` | ✅ test |
| **Breached passwords** | register / change / reset reject passwords found in known breaches; only a 5-char SHA-1 prefix leaves the server; fails open | `utils/breached.js` | ✅ test |
| **Email verification** | hashed single-use 24 h token, rate-limited, audited | `routes/auth.js` | ✅ test |
| **SSRF-safe crawling** | the per-event agent fetches third-party URLs: http(s) only, no credentials, ports 80/443 only, hostname resolved by the server and every address must be public (loopback/private/link-local/CGNAT/metadata/IPv6 incl. IPv4-mapped refused), connection pinned to the vetted address (no DNS rebinding), redirects re-validated per hop (max 4), 12 s / 1.5 MB / text-only caps, robots.txt honoured | `utils/safeFetch.js` | ✅ test (incl. redirect to 169.254.169.254) |
| **Crawler conduct** | robots.txt + Crawl-delay per URL, ≥1 s per host, ≤6 same-host pages, user-generated/personal-data paths never fetched, PII masked in stored text | `services/siteCrawler.js`, `utils/pii.js` | ✅ test (robots-blocked, forum and participant pages never requested) |
| **Query privacy** | private per-user history (own-only read, delete, cascade on account deletion, TTL); anonymous tally with no identifiers, PII-scrubbed, k≥2 display, opt-out; organiser sees aggregate only | `models/UserQuery.js`, `models/ListingQuestion.js` | ✅ test |
| **Untrusted page content** | event pages are treated as data: the model has no tools, the prompt forbids following instructions inside the page, answers are limited to one listing's context | `services/pageAgent.js` | ✅ test (injection text is not followed) |
| **Realtime auth** | Socket.IO handshake needs an HS256 JWT for an active user with a current tokenVersion (no unsigned/test tokens); server decides room membership; per-socket rate limit, 16 KB cap; sockets disconnected when a session is revoked | `services/realtime.js`, `models/User.js` | ✅ test (garbage/wrong-key/HS512/base64/test-token refused; password change drops the socket) |
| **Chat access control** | membership is the only rule; identical 404 for missing and not-yours; DMs need an accepted connection and no block; text only, 2000 chars, rendered as text | `services/chat.js` | ✅ test |
| **Social privacy** | opt-in discovery (default off), no email in any social response, no account enumeration by email, emails only to verified opted-in addresses, daily request/invite caps, blocking, full erasure on account deletion | `services/social.js`, `services/teams.js`, `services/erase.js` | ✅ test |
| **Calendar feed token** | the live feed is a capability URL: 192-bit random token, unique-indexed, `select:false` (never in any API response), rotated or revoked on demand, 404 for malformed/unknown/disabled-account tokens, `Cache-Control: private`; contains no notes or contact data; settings and personal downloads are sign-in only and `no-store` | `routes/calendar.js`, `models/User.js` | ✅ test |
| **Cache isolation** | every personalised route sends `Cache-Control: private, no-store` and `Vary: Authorization`; responses carry an `X-Request-Id` for tracing | `middleware/ops.js` | ✅ test |
| **Recommendation privacy** | picks, resume analysis, saved items and notifications are keyed on the verified token subject; no endpoint takes a user id; one user's resume never influences another's results | `routes/me.js`, `services/rag.js` | ✅ test (two users, different resumes) |
| **LLM safety** | assistant answers only from retrieved context; listing text is untrusted; no tools/actions are exposed to the model | `services/rag.js` | ✅ test (injection text in a listing is not followed) |

## Known gaps and residual risks (honest list)

1. **JWT in `localStorage`** is readable by any XSS. Mitigations present: React escapes output, strict CSP on the API, no `dangerouslySetInnerHTML`, external links use `rel="noopener noreferrer"`. For a hardened deployment, move to an httpOnly+SameSite cookie with CSRF tokens and serve the SPA with its own CSP.
2. **Email verification is soft**: sign-up sends a single-use, hashed, 24 h link and the UI nags until verified, but unverified users can still sign in. Make it a hard requirement for listers/Pro if abuse appears.
3. **No CAPTCHA.** Breached passwords are rejected (Pwned Passwords k-anonymity range API, fails open if unreachable). Rate limiting and lockout reduce but don't eliminate credential stuffing. Lockout can be used to annoy a specific user (account-lockout DoS); the IP limiter is the counterweight.
4. **Rate limits are per process memory** — use a shared store behind multiple instances. `trust proxy` must be set to your real proxy hop count in production.
5. **TLS is not terminated by the app.** Run behind HTTPS (reverse proxy / platform). HSTS is enabled only when `NODE_ENV=production`.
6. **Unofficial third-party endpoints** are fetched server-side (fixed hosts only, no user-supplied URLs → no SSRF surface). They can change or disappear.
7. **Resume text is stored in MongoDB** (needed for personalisation). Enable disk encryption / Atlas encryption at rest, and restrict database network access.
8. **Gemini mode** sends retrieved listing text and resume excerpts to Google. Disclose this to users before enabling it.
9. Dependencies should be audited regularly (`npm audit`) and pinned in CI.

## Reporting
Open a private issue with reproduction steps. Do not include real user data.

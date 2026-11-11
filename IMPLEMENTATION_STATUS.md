# Implementation status

_Last verified: 11 Nov 2026 (60/60 tests against a real MongoDB; live ingest: ~944 listings from 10 sources). Test evidence: [TEST_REPORT.md](TEST_REPORT.md). Sources: [SOURCE_COVERAGE_REPORT.md](SOURCE_COVERAGE_REPORT.md). Setup: [ENV_SETUP_GUIDE.md](ENV_SETUP_GUIDE.md). Brabble comparison: [BRABBLE_PARITY_REPORT.md](BRABBLE_PARITY_REPORT.md)._

## 1. Fully implemented and verified
Run in this session with automated tests and/or browser journeys.

| Area | Evidence |
|---|---|
| Email/password registration and login, password policy + strength meter, bcrypt-12, lockout, generic errors | e2e tests; journey 3 |
| JWT sessions with revocation (password change, sign out everywhere, admin disable), logout | e2e tests |
| Forgot/reset flow (hashed single-use 30-minute token); the email is logged in dev without SMTP | e2e tests |
| Roles user / lister / admin, server-side guards, no self-escalation | e2e tests; journeys 13–15 |
| Lister sign-up → admin approval → validated event template → publish/edit/unpublish → notifications | e2e tests; journeys 13–15 |
| Account deletion with re-authentication; last admin protected | e2e tests |
| Free / Pro plans by activation key; 402 gating | e2e tests; journey 6 |
| Resume parsing: PDF, DOCX, TXT (magic-byte check, in-memory) → skills, domains, graduation year, signals | `resume-pdf.test.js` (real PDF + DOCX fixtures); journey 7 |
| Recommender, Free and Pro: hard filters (expired / ineligible / duplicate / saved), eligibility reader, country-aware location, 0–100 deterministic scores, reasons, per-criterion breakdown | `recommender-profiles.test.js` (6 profiles); journeys 5 and 8 |
| RAG assistant, extractive mode (constraint parsing, MongoDB-stored embeddings, rubric re-rank, citations, prompt-injection resistance) | e2e tests; journey 11 |
| Browse, search, filters, sort; listing detail page; tracker; per-listing and feed `.ics` with a day-before alarm | e2e tests; journeys 1, 2, 9, 10 |
| In-app notifications (new matches, closing deadlines, approvals), idempotent | e2e tests; journey 12 |
| Ingestion pipeline mechanics: retries/backoff, pagination tracking, timezone-aware dates, prizes with currency, validation with reasons, cross-source dedup, stale removal only after complete syncs, failure isolation, sync history | `ingest-pipeline.test.js`, `ingest-db.test.js` |
| Admin console: source coverage dashboard, integrations check, listers, users, plans, roles, listing moderation, audit log, notifier | e2e tests; journey 14 |
| Responsive layout (390 px, no horizontal page scroll), dark/light theme, skeleton/empty/error states | journey 16; screenshots |
| Single-process production serving (`SERVE_CLIENT=true`) with a hash-based CSP for the SPA | e2e test; Chromium check |
| Email verification (soft, banner + `/verify`), breached-password rejection, installable PWA manifest | e2e tests; browser |
| **Multi-page event crawler** (official info pages + published FAQ, robots/Crawl-delay, 1 req/s, no user-generated areas) and **anonymous question analytics** (private history, opt-out tally, organiser insight) | `crawler.test.js` (9 tests); policy in docs/CRAWLER.md |
| **Network, teams, chat, reminders**: Free: connections and blocking, live DMs, joining invited teams/rooms and chatting in them, live notifications, email reminders, Register → tracker. Pro: hosting hackathon team rooms and invite-only private rooms (invites by connection/email, tracker Team up), teammate/team recommendations, smart people search, public teams + join requests, idea voting | `social.test.js` (13 tests with real WebSockets, incl. the plan split and downgrade grandfathering); two-browser run (live toast, badge, DM, team room, idea vote); docs/SOCIAL.md |
| **Calendar integration**: Google / Outlook / Microsoft 365 add-event links, RFC 5545 `.ics` (folded, escaped, stable UIDs), personalised downloads, and a live per-user subscription feed (secret token, rotate/revoke, chosen reminders, opt-in picks) | `calendar.test.js` (8 tests); browser run: Tracker sync panel and Add-to-calendar menu |
| **Ask this hackathon**: per-event agent that crawls the event's own page (SSRF-safe, robots-aware, cached in MongoDB) and answers only from it with sources | `page-agent.test.js`; live runs on Unstop, MLH and Devfolio listings |
| **Resume Studio** (For you page): drag-and-drop upload → parsed skills, inferred interests with scores, graduation year → picks refresh instantly; private to the user | browser run with `resume.pdf` fixture |
| **Privacy isolation** of recommendations/resume/saved/notifications between users; `no-store` on personalised responses | e2e test "personal data is private" |
| **Production ops**: request ids, JSON access logs, gzip, readiness probe, graceful shutdown, non-overlapping ingest, Dockerfile + compose, CI workflow, zero-install dev MongoDB (`npm run db`) | e2e health test; manual |
| Redesigned UI layer: sticky glass header, gradient hero, hover-lift cards, motion (respects reduced-motion), toasts, themed light/dark | screenshots |
| Security hardening (docs/SECURITY.md), 0 dependency vulnerabilities | e2e tests; `npm audit` |

## 2. Implemented but not externally verified
The code exists and is unit-tested where possible, but has not been run against the real third party.

| Area | What's missing | How to verify |
|---|---|---|
| **All 16 source adapters live** | Sandbox blocks every listing host | `cd server && npm run sources:check` on a normal machine; Admin → Sources |
| Google sign-in | Real OAuth client ID; the flow is tested with a mocked verifier | ENV_SETUP_GUIDE §2, then sign in by hand |
| Gemini answers (`gemini-2.5-flash`) and embeddings (`gemini-embedding-001`) | API key. Requests reach Google and are rejected only for the invalid test key | `npm run integrations:check gemini_generate gemini_embeddings` |
| Email (reset links, digests) | SMTP credentials; SMTP is blocked from the sandbox | `SMTP_TEST_TO=you@… npm run integrations:check smtp` |
| Kaggle and clist adapters | Free API keys | ENV_SETUP_GUIDE §5 |

## 3. Partially implemented
| Area | Gap |
|---|---|
| HTML/embedded-data adapters (MLH, ETHGlobal, GeeksforGeeks, DoraHacks) | Built with tolerant parsers (microdata, `__NEXT_DATA__`, JSON-LD, generic field names) but never seen a live payload. Expect small selector or field fixes after the first `sources:check -- --record` |
| Skill extraction | Dictionary of ~50 canonical skills with aliases; no model-based extraction |
| Semantic similarity | Local hashed bag-of-words by default; Gemini embeddings available but unverified |
| Notifications | In-app complete; email digest code exists but is unverified; no push |
| University portals | Covered only through Devfolio, Devpost, MLH and Unstop; no per-university adapters |
| Accessibility | Labels, focus styles, `aria-*` on toggles, skip link; no formal WCAG/axe audit |

## 4. Not implemented
- Payments/billing for Pro (activation keys instead; replace the check in `server/routes/plan.js` with a payment webhook).
- CAPTCHA.
- Background worker separation (jobs run in the API process: run one instance).
- Native mobile app / PWA / push notifications.

## 5. Blocked by unavailable third-party access
| Blocker | Unblock |
|---|---|
| brabble.ai unreachable, so no side-by-side product comparison | Follow the procedure in BRABBLE_PARITY_REPORT.md from a normal browser |
| Listing sites unreachable, so no live counts | Run `npm run sources:check`, or allow the domains in the cloud environment's network settings |
| No credentials for Google, Gemini, SMTP, Kaggle, clist | ENV_SETUP_GUIDE.md |
| Push to GitHub refused (Claude GitHub App has no access to `mukundgaur06/FSD_PROJ`) | Reconnect GitHub / install the app; the commits are on the local branch |

## Known limitations
- **Realtime scale-out**: one Node process. Several instances need the Socket.IO Redis adapter and a single reminder worker (see docs/SOCIAL.md).
- **Chat moderation**: users can block and leave; there is no report/review queue or message editing/deleting yet.
- **Calendar sync on localhost**: Google Calendar and Outlook on the web fetch the feed from their own servers, so they cannot reach a `localhost` feed URL. Apple Calendar / desktop Outlook on the same machine can. Set `APP_URL` to the public address after deploying.
- **Per-event agent coverage**: pages rendered only by JavaScript (Unstop, many Devfolio sites) yield just the stored listing data, and sites that block bots (Devpost answers HTTP 403) are not bypassed. The agent says so in the answer. A headless-browser fetch would widen coverage but is heavier and raises robots/ToS questions.
- **DoraHacks** sits behind a bot-verification wall (checked 11 Nov 2026). We don't bypass it, so the source shows as *skipped* on Admin → Sources until `DORAHACKS_API_URL` points at an authorised endpoint. **ETHGlobal** is fixed: the parser now reads the live card layout (4 upcoming events at time of writing). Kaggle and clist need free keys.
- Third-party endpoints are unofficial except Codeforces, Kaggle, clist and Topcoder; any can change. A failing source shows on Admin → Sources and never blocks the others.
- Prize rupee values for foreign currencies are estimates (`USD_TO_INR`, `EUR_TO_INR`, `GBP_TO_INR`); the original amount is always shown.
- JWT is stored in `localStorage` (see docs/SECURITY.md for mitigations).

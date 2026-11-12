# Testing

> Short version: **`npm run verify`** runs everything that matters (server tests + client build + a live end-to-end run) and must be green before a change merges. Nothing in the test suites touches your real data: each suite creates and drops its own database.

## The layers

| Layer | Command | What it proves | Runs against |
|---|---|---|---|
| **Unit and integration** | `npm test` | Parsers, scoring, validation, the HTTP API, auth, privacy, chat, teams, reminders, calendar, crawler | the real Express app in-process + a **real MongoDB** + **real WebSocket clients** |
| **In-process journey** | part of `npm test` (`tests/journey.test.js`) | the whole product story in one narrative, 41 checks in 11 phases | same as above |
| **Live end-to-end** | `npm run e2e` | the **same journey against a separately started server process** (`node server.js`), exactly as deployment runs it: start-up, migrations, admin creation, health, real network stack | a child process on a free port + an isolated database `hackelite_live_e2e` |
| **Client build** | `npm run build` | the React app compiles | Vite |
| **Browser journeys** (optional) | `node e2e/journeys.js` | 16 click-through flows in real Chromium with screenshots (needs `playwright`, the API and `npm run web` running) | the running dev stack |
| **Integration self-check** | `npm run integrations:check` | real requests to Gemini, SMTP, Google, Kaggle, clist, MongoDB with *your* credentials | the real third parties |
| **Source check** | `npm run sources:check` | each of the 16 ingestion adapters against its live site | the real internet |

Why both an in-process and a live run? The in-process suite is fast and debuggable; the live run catches the class of bug that only appears in a real server process. It already did: a valid PDF resume returned `500` in the live server because uploads arrive as a view into a shared network buffer (see `fix(resume)` in `git log`). The in-process tests could never see that.

## Requirements
A reachable MongoDB: `MONGO_URI` (default `mongodb://127.0.0.1:27017`). No MongoDB installed? Run `npm run db` in another terminal (a real, persistent one). In CI a `mongo:7` service is used.

## Test files

| File (`server/tests/`) | Tests | Covers |
|---|---:|---|
| `e2e.test.js` | 20 | security headers and CORS, body limits, password policy, register/login/lockout, NoSQL injection and prototype pollution, privilege escalation, reset/verification, plans, resume, RAG assistant, listings API, saved tracker, calendar basics, notifications, lister approval, admin guards, rate limiting, account deletion, SERVE_CLIENT CSP, privacy isolation, health, breached passwords |
| `journey.test.js` + `helpers/journey.js` | 1 (11 phases) | the full product journey, shared with `npm run e2e` (below) |
| `social.test.js` | 13 | connections and blocking, live notifications, DMs over WebSocket, socket auth attacks, private rooms, teams and invites, tracker share, **Free/Pro split**, downgrade grandfathering, Pro recommendations privacy, join requests and idea voting, email reminders, account-deletion cascade |
| `calendar.test.js` | 9 | RFC 5545 folding/escaping/UTC/UIDs, reminders, Google/Outlook links, per-user feed token (rotate, revoke, privacy), token index |
| `page-agent.test.js` | 7 | SSRF guard (private IPs incl. IPv4-mapped IPv6), robots.txt parsing, extraction, endpoint, cache, prompt injection, robots-blocked and private redirects |
| `crawler.test.js` | 9 | same-site link discovery, FAQ extraction, PII scrubbing, Crawl-delay, question keys, **never fetches forum/participant/robots-blocked pages**, ≥1 s spacing, anonymous question tally, private history, organiser view |
| `ingest-pipeline.test.js` | 15 | dates/timezones, prize parsing, validation reasons, dedupe, pagination, retries, adapters with stubbed HTTP, ETHGlobal live layout, HTML entities |
| `ingest.test.js`, `ingest-db.test.js` | 5 + 2 | normalisation helpers; runner persistence (upsert, stale removal only after complete syncs, saved items kept) |
| `recommender-profiles.test.js` | 10 | six realistic student profiles: what a sensible advisor would pick and what must never appear; determinism; free tier |
| `engine.test.js`, `resume-pdf.test.js` | 6 + 4 | resume text analysis; real PDF and DOCX fixtures; buffer-view regression; unreadable PDF → 400 |
| `ask-place.test.js` | 2 | place parsing and the hard place filter |

`npm test` reports 114 because node counts sub-tests (the journey's phases). Fixtures: `tests/fixtures/resume.pdf` (a real Chromium-rendered PDF) and `resume.docx`.

## The product journey (what `npm run e2e` checks)

Written once in `server/tests/helpers/journey.js`, run in-process by `journey.test.js` and against a real process by `server/scripts/e2e-live.js`. Every step uses only the public HTTP API and Socket.IO, like the browser.

| # | Phase | Highlights |
|---|---|---|
| 1 | Platform | liveness/readiness, security headers, request ids, 404, 413 |
| 2 | Accounts | weak password refused, verification email → single-use link, generic login errors, injection payloads, profile, password change revokes sessions, forgot/reset by email |
| 3 | Discovery | seeded catalogue; filters, search, sort, expired events hidden, detail, public calendar |
| 4 | Plans, resume, recommendations | Free gate (402), Pro activation, real PDF parsed (fake refused), 8-criterion rubric sorted/deterministic, Ask with hard place filter, RAG assistant resists prompt injection |
| 5 | Tracker and calendar | note, Register → applied (never downgrades), personalised `.ics`, live feed token, rotate/revoke |
| 6 | Per-hackathon agent | crawls FAQ with citations (in-process) / **refuses private addresses (live)**, metadata IP blocked, anonymous question tally, private history |
| 7 | Network, chat, teams | opt-in discovery, live notifications, DMs over WebSocket, Free can't host, Pro host + free invitee, team room, idea voting, Pro recommendations, private room, blocking |
| 8 | Reminders | one email in the window, never twice, only opted-in |
| 9 | Organiser and admin | lister approval, template validation, publish/delete, audit log, access control |
| 10 | Privacy sweep | `no-store` on personal routes, secrets never serialised, cross-user isolation |
| 11 | Erasure | re-auth required, session revoked, team handed over, DM deleted |

### How the live runner works (`server/scripts/e2e-live.js`)
1. Drops the isolated database `hackelite_live_e2e`, then boots `node server.js` on a free port with: a known admin, ingestion off, **rate limits off** (`DISABLE_RATE_LIMITS=1`, ignored in production), **mail printed instead of sent**, and Google/Gemini/SMTP blanked so it never touches real services.
2. Waits for `/api/health/ready`, runs the journey, prints each check with timing, stops the server (graceful `SIGTERM` check on Linux/macOS), drops the database, and exits non-zero on any failure.

Debugging switches (all optional): `E2E_PHASES=2,4` run only those phases (later phases depend on earlier state) · `E2E_SKIP="text|text"` skip steps whose label contains the text · `E2E_VERBOSE=1` print the whole server log on failure.

## Writing tests here

- Use the existing pattern: set `NODE_ENV=test` and a unique `MONGO_DB_NAME` at the top, boot `buildApp().listen(0)`, drop the database in `after`.
- **Personal data → two users.** Prove user B cannot see user A's data, not just that A can.
- **New route → five cases**: success, validation (400), no token (401), wrong role/plan (403/402), someone else's id (404).
- Mail: in tests `services/mailer.js` records messages in `outbox` instead of sending.
- Real-time: use `socket.io-client` with `transports: ['websocket']` and wait on events with a timeout; always close sockets in `after`.
- Use `ALLOW_PRIVATE_FETCH=127.0.0.1` (test only, per host) to let a test crawl its own local fake site while everything else stays blocked.

## CI
`.github/workflows/ci.yml` runs on every push/PR: server tests, the live end-to-end run (with a `mongo:7` service), the client build, `npm audit` (high severity), and a Docker image build.

## Earlier reports
Historical audit and test reports from the takeover are kept in [reports/](reports/) for the record; this page and [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) are current.

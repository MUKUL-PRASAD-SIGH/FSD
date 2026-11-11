# Architecture and system design

## 1. Overview

```
                    ┌────────────────────────── Browser (React SPA) ──────────────────────────┐
                    │ Browse · For you · Ask · Assistant(Pro) · Tracker · Profile · Plan       │
                    │ Lister dashboard · Admin console · Notifications bell                    │
                    └───────────────┬─────────────────────────────────────────────────────────┘
                                    │ HTTPS, JSON, Authorization: Bearer <JWT>
                    ┌───────────────▼───────────────  Express API (stateless) ────────────────┐
  helmet · CORS allowlist · rate limits · JSON size cap · NoSQL sanitiser · error handler      │
  ├─ routes: auth · listings · me · ask · plan · assistant · lister · admin                    │
  ├─ authz middleware: protect → requireRole → requirePro → requireApprovedLister             │
  ├─ services: recommender · rag · embeddings · notifier · resumeParser · audit · mailer      │
  └─ jobs (in-process, hourly): ingest 16 sources → validate → dedupe → embed new listings → run notifier          │
                    └───────┬──────────────────────────┬──────────────────────┬──────────────┘
                            │                          │                      │
                  ┌─────────▼─────────┐     ┌──────────▼─────────┐   ┌────────▼────────┐
                  │     MongoDB       │     │ Public listing APIs │   │ Optional: Google │
                  │ users, listings   │     │ Unstop, Devpost,    │   │ sign-in, Gemini, │
                  │ (+embeddings),    │     │ Devfolio, HackerEarth│  │ SMTP             │
                  │ saved, notifs,    │     │ Codeforces, CodeChef,│  └─────────────────┘
                  │ audit             │     │ LeetCode            │
                  └───────────────────┘     └────────────────────┘
```

Everything persistent lives in **MongoDB** — accounts, listings, vectors, notifications, audit log. No Redis, no vector database, no queue.

## 2. Data model (MongoDB collections)

| Collection | Key fields | Indexes |
|---|---|---|
| `users` | email (unique), password hash (bcrypt-12, `select:false`), googleId (sparse unique), `role` user/lister/admin, `status`, `plan.tier`, `lister.approvalStatus`, `tokenVersion`, `failedLogins/lockUntil`, profile (skills, interests, location, education, preferences, notify), `resume` (parsed fields, `text` and `chunks[{text, embedding}]` both `select:false`) | email, googleId, role |
| `listings` | title, organiser, type, mode, city/state/country/venue, deadline + `deadlineKind`, start/end dates, prize (`prizeInr`, `prizeAmount`, `prizeCurrency`), fee, team size, eligibility, tags, skills, `source`, `externalId`, `alsoOn[]`, `inferred[]`, `status` published/unpublished, `createdBy`, `embedding` (`select:false`), `embeddingModel` | (source, externalId) unique partial; (status, deadline); (source, refreshedAt); (status, platform, deadline); text index |
| `sourcesyncs` | source, runId, status ok/partial/failed/skipped, error, raw/valid/expired/duplicates/rejected/stored/removedStale, rejectReasons, rejectSamples, pages {fetched, expected, complete, capped} | (source, createdAt); TTL 90 days |
| `saveds` | user, listing, status (saved→applied→shortlisted→won/rejected), note | (user, listing) unique |
| `notifications` | user, type, listing, title, body, score, readAt | (user, listing, type) unique partial → idempotent; (user, readAt, createdAt) |
| `auditlogs` | actor, action, target, meta, ip, createdAt | createdAt, action |

## 3. Key flows

**Auth.** `register` validates the password policy server-side, hashes with bcrypt cost 12, and issues a JWT `{id, tv}` (HS256, 7 d). `tv` is the user's `tokenVersion`: changing the password, "sign out everywhere", disabling or re-roling a user bumps it, which invalidates every outstanding token immediately without a token blacklist. Five failed logins lock the account for 15 minutes; unknown emails run a dummy bcrypt compare so timing and messages don't reveal which emails exist.

**Google sign-in.** The browser obtains a Google ID token; the server verifies signature, expiry, issuer and `aud == GOOGLE_CLIENT_ID` (`google-auth-library`) and requires `email_verified`. Existing email → linked (safe, Google verified ownership); new → account created (role `user`, or `lister` with organisation details). Google-only accounts have no password and can set one later.

**Lister approval.** Lister sign-up creates `role=lister, lister.approvalStatus=pending` and notifies all admins. `requireApprovedLister` blocks publishing until an admin approves (decision + note are audited and the lister is notified). Approved listers publish via a validated template (`utils/listingInput.js`); listings go live immediately, are owner-scoped for edit/delete, and admins can unpublish.

**Ingest → index → notify (hourly).** Adapters fetch each source independently (a failing source is reported and skipped) → upsert by `(source, externalId)` → expired rows purged → new listings embedded → notifier scores each user's *new* listings and creates `new_match` notifications above the user's threshold, plus `deadline` alerts for saved items closing within 48 h. The unique index makes reruns idempotent. Publishing a listing triggers the same notifier immediately.

**Plan gating.** `requirePro` is enforced on resume upload and the assistant on the server (HTTP 402 `PRO_REQUIRED`); the UI hides/locks them only for convenience. Activation compares the key against `PRO_ACTIVATION_KEYS` in constant time and is rate-limited and audited.

## 4. Recommendation engine

Two tiers share one module (`services/recommender.js`):
- **Free**: `0.45·interests + 0.35·skills + 0.20·urgency`.
- **Hard filters (both tiers)**: expired, clearly ineligible (education level / graduation batch, `services/eligibility.js`), already saved, duplicate (same normalised title, deadlines within 10 days). Counts are returned as `excluded`.
- **Pro rubric**: `skills .22, semantic .18, interests .12, location .14, eligibility .08, preferences .10, timing .08, value .08`, with multiplicative penalties for in-person events abroad (×0.5), in-person elsewhere when the user does not travel (×0.75), unverifiable eligibility conditions (×0.9) and paid events for free-only users (×0.6). Output includes `criteria[]` (label, weight, score, points, detail) and reasons. Ordering is deterministic (score, deadline, id).

## 4b. Ingestion pipeline
`services/ingest/`: `http.js` (timeouts, retry/backoff on network errors, 429 and 5xx, Retry-After, per-host delay, pagination tracking) → adapters in `sources/` return raw records → `validate.js` (keep / expired / reject with a reason) → `dedupe.js` (cross-source merge by canonical URL or title + dates; native source over aggregator; `alsoOn` attribution) → `run.js` upserts primaries, removes merged duplicates (moving users' tracker entries), removes stale listings only after a *complete* paginated sync, and writes one `SourceSync` document per source per run (admin Sources dashboard). Adapters run in parallel with `Promise.allSettled`, so one failure never blocks the rest. Details: [SOURCE_COVERAGE_REPORT.md](../SOURCE_COVERAGE_REPORT.md).

Design choices: deterministic and inspectable (no black-box model), skills extracted by a word-boundary dictionary (so `java` ≠ `javascript`), geography via an in-repo India city/state map (no geocoding API).

## 5. RAG pipeline (Pro)

1. **Index** – each listing → one document (title, organiser, type, mode, city, tags, skills, eligibility, description) → embedding stored on the listing with its model name. Resume → ≤ 20 overlapping 650-char chunks → embeddings stored on the user.
2. **Embeddings** – `local-hash-v1` (384-d feature-hashing over words, bigrams and canonical skill tokens; no network, deterministic) or Gemini `gemini-embedding-001` truncated to 768-d via `EMBEDDINGS_PROVIDER`. Vectors of different models are never compared; a model switch re-indexes lazily.
3. **Retrieve** – parse hard constraints from the question (type, mode, closing window, prize, free) and filter the pool; embed the question; score = 0.65·question-similarity + 0.35·profile-similarity; re-rank with the rubric (0.6 relevance + 0.4 rubric); add the 2 best resume chunks.
4. **Generate** – grounded prompt with numbered context. Gemini if configured; otherwise an **extractive** answer assembled from the top matches. Listing text is treated as untrusted data (prompt-injection safe by construction in extractive mode; instruction-fenced in Gemini mode). Responses carry citations.

Similarity search is an in-process cosine scan over a few thousand vectors — adequate here; see §7 for scale-out.

## 6. Security architecture
See [SECURITY.md](SECURITY.md). Principle: **authorisation is always enforced on the server**; the client only hides things.

## 5b. Per-event agent ("Ask this hackathon")
Every listing page has an agent that answers questions about that one event.
1. **Crawl on demand** (`services/pageAgent.js`): when a signed-in user asks, the server reads the event's own URL through `utils/safeFetch.js` (see SECURITY.md), honouring `robots.txt`, and caches the extracted passages in `listingpages` (MongoDB TTL index: 6 h on success, 10 min on failure) so repeat questions don't hit the organiser's site.
2. **Extract**: cheerio drops scripts/nav/forms, keeps headings + paragraphs/list items/table cells, meta description and schema.org `Event` JSON-LD, and splits them into passages. Pages that render only with JavaScript (Unstop, many Devfolio sites) are detected and reported honestly.
3. **Context** = page passages + the stored listing record split into one passage per fact (deadline, prize, eligibility, team size…). Nothing from other events or other users is ever in the context.
4. **Retrieve** with embeddings + question-word coverage + an intent boost (eligibility/prize/deadline/team/fee/location questions favour the matching record fact).
5. **Answer**: Gemini if `GEMINI_API_KEY` is set (system prompt: answer only from context, cite, ignore instructions in the page), otherwise an extractive answer quoting passages. If nothing matches it says so and lists what is known. Sources are returned with every answer.
6. **Multi-page crawl** (`services/siteCrawler.js`): beyond the event URL it follows up to 6 same-host links to official info pages (FAQ, rules, schedule, prizes…), never user-generated areas, one request/second, `robots.txt` + `Crawl-delay` per URL, and extracts published Q&A. Policy: [CRAWLER.md](CRAWLER.md).
7. **Question analytics** (`services/communityQuestions.js`): your own history (`userqueries`, private, 180-day TTL, deleted with the account) is separate from an anonymous tally (`listingquestions`: no user id; PII-scrubbed; shown only at 2+ asks; opt-out via `privacy.shareQuestions`). Organisers see the aggregate for their own events via `GET /api/lister/listings/:id/questions`.
Endpoints: `POST /api/listings/:id/ask`, `GET|DELETE /api/listings/:id/ask/history`, `GET /api/listings/:id/questions` (all sign-in required, `no-store`).

## 6b. Operations and deployment
- **Request pipeline** (`server.js`): request id → security headers/CORS/rate limit → gzip → access log → `Cache-Control: private, no-store` on every personalised route (`/me`, `/auth`, `/ask`, `/assistant`, `/plan`, `/lister`, `/admin`) → body parsing and sanitising → routers → error handler (no stack traces to clients).
- **Health**: `/api/health` is liveness; `/api/health/ready` returns 503 until MongoDB is connected, so an orchestrator only routes traffic to a working instance. The Docker `HEALTHCHECK` uses it.
- **Graceful shutdown**: SIGTERM/SIGINT stop accepting connections, drain in-flight requests, close MongoDB, then exit (hard stop after 10 s).
- **Ingestion safety**: syncs never overlap inside a process; run **one** API instance until jobs move to a worker (see table below).
- **Packaging**: `Dockerfile` (multi-stage, non-root, serves API + built client) and `docker-compose.yml` (app + MongoDB 7 with a volume and health-gated start). CI (`.github/workflows/ci.yml`) runs the full suite against a Mongo service, `npm audit`, and the client build.
- **Local MongoDB**: no install needed, `cd server && npm run db` starts a real persistent mongod on 27017 (data in `.data/mongo`).

## 6c. Privacy model for recommendations
Every recommendation query is derived from `req.user` (the verified JWT subject) and nothing else: profile, resume chunks and embeddings are read by `User.findById(req.user._id)`; saved items and notifications are filtered by `user: req.user._id`; no route accepts a user id from the client. Resume text/chunks are `select: false` and are never serialised. Personalised responses are `no-store` so a shared cache can't serve one user's picks to another. `server/tests/e2e.test.js` ("personal data is private") proves two users with different resumes never see each other's data.

## 7. Scaling and trade-offs

| Concern | Today | At larger scale |
|---|---|---|
| Vector search | brute-force cosine in Node (≈ 400 listings: milliseconds) | MongoDB Atlas Vector Search (`$vectorSearch`) on `listings.embedding`; same schema |
| Jobs | `setInterval` inside the API process | separate worker + queue (BullMQ/SQS); leader election if running >1 API instance |
| Rate limiting | in-memory per instance | Redis store (`rate-limit-redis`) so limits are shared |
| Notifier | O(users × new listings) per run | fan-out per listing using inverted skill/domain indexes; batch by user cohort |
| Sessions | stateless JWT + `tokenVersion` | add refresh tokens + short access TTL; move token to an httpOnly cookie with CSRF protection |
| Ingestion | unofficial public endpoints | official partner APIs / feeds where available |
| Billing | key-based activation | payment provider webhook sets `plan.tier` |
| Observability | request ids (`X-Request-Id`), one JSON access log line per request in production, `/api/health` (liveness) and `/api/health/ready` (readiness), audit collection | ship logs to a pipeline, add metrics (Prometheus) and alerting |

Deliberate simplifications: no email verification flow, no CAPTCHA, no password-breach lookup, single-region, single Mongo node.

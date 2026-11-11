# HackElite

Hackathons, case competitions and contests from 16 sources in one place (de-duplicated across platforms), with **role-based accounts**, **in-app notifications**, and a **Pro plan** that ranks everything against your resume and location using a MongoDB-backed RAG pipeline.

MongoDB is the only datastore. The previous version of the project is preserved in [`old/`](old/).

> **Docs:** [IMPLEMENTATION_STATUS](IMPLEMENTATION_STATUS.md) (what is verified vs not) · [TEST_REPORT](TEST_REPORT.md) · [SOURCE_COVERAGE_REPORT](SOURCE_COVERAGE_REPORT.md) · [ENV_SETUP_GUIDE](ENV_SETUP_GUIDE.md) (every key, step by step) · [TAKEOVER_AUDIT](TAKEOVER_AUDIT.md) · [BRABBLE_PARITY_REPORT](BRABBLE_PARITY_REPORT.md) · [ARCHITECTURE](docs/ARCHITECTURE.md) · [SECURITY](docs/SECURITY.md) · [CRAWLER](docs/CRAWLER.md) (crawler policy, question privacy)

## Plans

| | **Free** | **Pro** |
|---|---|---|
| Browse, filter, sort live listings from 16 sources, listing detail pages | ✅ | ✅ |
| Save / track applications (Kanban) | ✅ | ✅ |
| Add to Google / Outlook / Apple calendar, live personal calendar feed with your own reminders, public JSON API | ✅ | ✅ |
| In-app notifications for new matches and closing deadlines | ✅ (basic score) | ✅ (rubric score) |
| Plain-English search ("online AI hackathons closing soon") | ✅ | ✅ |
| Basic picks from your skills and interests | ✅ | ✅ |
| Resume upload and parsing | ❌ | ✅ |
| Location-aware ranking (city, state, travel) + eligibility | ❌ | ✅ |
| 8-criterion recommendation rubric with explanations | ❌ | ✅ |
| RAG assistant with cited answers | ❌ | ✅ |

### Switching to Pro (no billing yet)
Pro is activated with a key. Set one or more comma-separated keys in the root `.env`:

```
PRO_ACTIVATION_KEYS=HACKELITE-PRO-DEMO-2026
```

Then sign in → **Upgrade** (or `/plan`) → paste the key → **Activate Pro**. `HACKELITE-PRO-DEMO-2026` is the documented demo key; **change it before deploying** (the server refuses to start in production without keys). Admins can also grant or revoke Pro per user in the Admin console. *Replace the key check in `server/routes/plan.js` with a payment webhook when you add billing.*

## Roles

| Role | How you get it | Can do |
|---|---|---|
| **user** | Default sign-up | Browse, save, notifications, profile, Free/Pro features |
| **lister** | Sign up with "I run events" (needs organisation details) | After **admin approval**: publish, edit and delete own events via the event template. Before approval: can sign in but not publish |
| **admin** | Created from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env` on server start; can promote others | Approve/reject listers, manage users and plans, unpublish listings, view the audit log, run the notifier |

`admin` can never be self-selected through the API.

## Quick start

Requires **Node 20+** and a MongoDB. No MongoDB installed? Run `cd server && npm install && npm run db` in a spare terminal: it starts a real, persistent local database on `127.0.0.1:27017` (the default `MONGO_URI`).

**Or run everything with Docker:** `docker compose up --build` → http://localhost:5050 (app + MongoDB, production mode; needs the root `.env`).

```bash
# 1. configure (the .env already in the repo root is git-ignored; see .env.example for every option)
cp .env.example .env        # then fill JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD

# 2. API  → http://localhost:5050   (pulls live listings on boot, then hourly)
cd server && npm install && npm start

# 3. Web  → http://localhost:5173   (proxies /api to 5050)
cd client && npm install && npm run dev
```

Generate a secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
The admin password must satisfy the policy (10+ chars, upper/lower, digit, symbol; passwords found in known data breaches are rejected).
`npm run seed` adds 12 offline sample listings (auto-removed after the first live ingest).

### Environment variables
| Variable | Required | Purpose |
|---|---|---|
| `MONGO_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | ≥ 32 chars; server warns (dev) or refuses to start (prod) otherwise |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | ✅ first run | Bootstrap the first admin |
| `PRO_ACTIVATION_KEYS` | for Pro | Comma-separated Pro keys |
| `API_PORT`, `CLIENT_ORIGIN` | defaults 5050 / `http://localhost:5173` | Port and CORS allowlist |
| `GOOGLE_CLIENT_ID` | optional | Enables "Continue with Google" (the browser reads it from the API; no client env needed) |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `EMBEDDINGS_PROVIDER` | optional | Generated assistant answers / Gemini embeddings (default is a local model, no key) |
| `SMTP_URL`, `MAIL_FROM`, `APP_URL` | optional | Password-reset and digest emails |
| `ENABLED_SOURCES`, `DISABLE_INGEST`, `INGEST_*`, `USD_TO_INR` | optional | Ingestion controls |
| `KAGGLE_USERNAME`/`KAGGLE_KEY`, `CLIST_USERNAME`/`CLIST_API_KEY` | optional | Extra sources (free keys) |
| `SERVE_CLIENT` | production | Serve `client/dist` from the API with a page CSP |

Where to get every key, and how to verify it with a real request (`npm run integrations:check`), is in [ENV_SETUP_GUIDE.md](ENV_SETUP_GUIDE.md).

## How recommendations work

**Both tiers first remove** expired listings, listings you are clearly **not eligible** for (education level or graduation batch stated by the organiser), duplicates and listings already in your tracker, and say how many were hidden.

**Free (basic):** `0.45 interests + 0.35 skills + 0.20 urgency`, from the skills and interests you type.

**Pro (rubric, 0–100):** `skills .22 · semantic .18 · interests .12 · location .14 · eligibility .08 · preferences .10 · timing .08 · value .08`.
- *semantic*: cosine similarity between your profile (+ resume chunks) and listing embeddings.
- *location*: online = 1; your city = 1; a city you like = .9; hybrid = .75; your state = .7; open to travel = .45; in person elsewhere = .1 (×0.75 penalty); in person in another country = .05 (×0.5 penalty).
- *eligibility*: your education level vs. the listing's audience. *timing*: enough days left to prepare for that kind of event. *value*: prize size vs. how crowded it is.
- Every card shows a 0–100 score, plain-English reasons and "Why this score?": each criterion's points (weight × score) with a one-line explanation. Same inputs always give the same order.

**RAG assistant (Pro):** listing text and resume chunks are embedded and stored in MongoDB → your question is parsed for hard constraints (online / closing this week / ₹1L+) → candidates are retrieved by similarity and re-ranked by your rubric → the answer cites its sources. With `GEMINI_API_KEY` the answer is generated from the retrieved context only; without it you get an extractive answer built from the top matches (never invented).

## Sources
Unstop · Devpost · Devfolio · HackerEarth · Codeforces · CodeChef · LeetCode · MLH · Hack Club · ETHGlobal · DoraHacks · AtCoder · Topcoder · GeeksforGeeks · Kaggle (free key) · clist.by aggregator (free key), plus events published by approved listers.
Each source is an independent adapter in `server/services/ingest/sources/`. Records are validated (with documented reject reasons), de-duplicated across platforms, and every sync is recorded for the **Admin → Sources** coverage dashboard. Check all sources live without a database: `cd server && npm run sources:check`. Details and confidence per source: [SOURCE_COVERAGE_REPORT.md](SOURCE_COVERAGE_REPORT.md). Respect each site's terms and keep the hourly interval.

## Tests
```bash
cd server && npm test                    # 54 tests; real MongoDB in throwaway databases (dropped afterwards)
node e2e/journeys.js                     # 16 browser journeys (needs API + `npx vite` running), screenshots in docs/screenshots/
cd server && npm run integrations:check  # real requests to every configured integration
cd server && npm run sources:check       # live check of every listing source (no database)
```
Your real data is never touched by `npm test`. Results: [TEST_REPORT.md](TEST_REPORT.md).

## Layout
```
server/   Express + Mongoose: config, middleware, models, routes, services (recommender, rag, embeddings, notifier, ingest, resumeParser)
client/   React + Vite (no 3D/WebGL, ~100 KB gzipped JS)
docs/     ARCHITECTURE.md, SECURITY.md, screenshots/
e2e/      Playwright browser journeys
scripts/  setup-dev-tools.sh (MongoDB, Ghidra, REA)
old/      previous project
```

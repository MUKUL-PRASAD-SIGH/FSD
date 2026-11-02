# HackElite

Live hackathons, case competitions and contests from 7 platforms in one place, with **role-based accounts**, **in-app notifications**, and a **Pro plan** that ranks everything against your resume and location using a MongoDB-backed RAG pipeline.

MongoDB is the only datastore. The previous version of the project is preserved in [`old/`](old/).

> Status, test results and what still needs external setup: **[IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)**
> Architecture and system design: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · Security: [docs/SECURITY.md](docs/SECURITY.md)

## Plans

| | **Free** | **Pro** |
|---|---|---|
| Browse, filter, sort live listings from 7 platforms | ✅ | ✅ |
| Save / track applications (Kanban) | ✅ | ✅ |
| Calendar (.ics) deadline reminders, public JSON API | ✅ | ✅ |
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

Requires **Node 20+** and a running **MongoDB**.

```bash
# 1. configure (the .env already in the repo root is git-ignored; see .env.example for every option)
cp .env.example .env        # then fill JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD

# 2. API  → http://localhost:5050   (pulls live listings on boot, then hourly)
cd server && npm install && npm start

# 3. Web  → http://localhost:5173   (proxies /api to 5050)
cd client && npm install && npm run dev
```

Generate a secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
The admin password must satisfy the policy (10+ chars, upper/lower, digit, symbol, not a common word).
`npm run seed` adds 12 offline sample listings (auto-removed after the first live ingest).

### Environment variables
| Variable | Required | Purpose |
|---|---|---|
| `MONGO_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | ≥ 32 chars; server warns (dev) or refuses to start (prod) otherwise |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | ✅ first run | Bootstrap the first admin |
| `PRO_ACTIVATION_KEYS` | for Pro | Comma-separated Pro keys |
| `API_PORT`, `CLIENT_ORIGIN` | defaults 5050 / `http://localhost:5173` | Port and CORS allowlist |
| `GOOGLE_CLIENT_ID` + `VITE_GOOGLE_CLIENT_ID` (client/.env) | optional | Enables "Continue with Google" |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `EMBEDDINGS_PROVIDER` | optional | Generated assistant answers / Gemini embeddings (default is a local model, no key) |
| `SMTP_URL`, `MAIL_FROM`, `APP_URL` | optional | Password-reset and digest emails |
| `ENABLED_SOURCES`, `DISABLE_INGEST`, `USD_TO_INR` | optional | Ingestion controls |

Where to get the optional keys is listed in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md#what-needs-external-setup).

## How recommendations work

**Free (basic):** `0.45 interests + 0.35 skills + 0.20 urgency`, from the skills and interests you type.

**Pro (rubric, 0–100):** `skills .22 · semantic .18 · interests .12 · location .14 · eligibility .08 · preferences .10 · timing .08 · value .08`.
- *semantic*: cosine similarity between your profile (+ resume chunks) and listing embeddings.
- *location*: online = 1; your city = 1; a city you like = .9; your state = .7; open to travel = .45; otherwise .1 (and a score penalty).
- *eligibility*: your education level vs. the listing's audience. *timing*: enough days left to prepare for that kind of event. *value*: prize size vs. how crowded it is.
- Every card shows plain-English reasons and an expandable per-criterion breakdown.

**RAG assistant (Pro):** listing text and resume chunks are embedded and stored in MongoDB → your question is parsed for hard constraints (online / closing this week / ₹1L+) → candidates are retrieved by similarity and re-ranked by your rubric → the answer cites its sources. With `GEMINI_API_KEY` the answer is generated from the retrieved context only; without it you get an extractive answer built from the top matches (never invented).

## Sources
Unstop (hackathons, competitions, case competitions, quizzes) · Devpost · Devfolio · HackerEarth · Codeforces · CodeChef · LeetCode, plus events published by approved listers. Each source is an independent adapter in `server/services/ingest/sources/`. These are unofficial public endpoints; respect each site's terms and keep the hourly interval.

## Tests
```bash
cd server && npm test
```
25 tests: 13 end-to-end (real MongoDB in an isolated `hackelite_e2e_test` database that is dropped afterwards, real HTTP) and 12 unit/format tests. Your real data is never touched.

## Layout
```
server/   Express + Mongoose: config, middleware, models, routes, services (recommender, rag, embeddings, notifier, ingest, resumeParser)
client/   React + Vite (no 3D/WebGL, ~100 KB gzipped JS)
docs/     ARCHITECTURE.md, SECURITY.md
old/      previous project
```

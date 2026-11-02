# HackElite

Live hackathons, case competitions and contests, **ranked against your resume**. MongoDB is the only datastore.

The previous version (3D landing page, admin console, team formation, Gemini chat) is preserved in [`old/`](old/).

## What it does

| Feature | How it works |
|---|---|
| **Browse** | Light landing page + filterable grid (type, mode, free, closing this week, sort by deadline/prize/popularity). |
| **Resume parsing** | Upload PDF / DOCX / TXT. Text is extracted in memory (file is not stored), then a dictionary parser finds ~50 skills, scores domains, graduation year, education, links and experience signals. |
| **For you** | Recommendation engine ranks every open listing against your skills, interests, preferences and resume text, and shows *why* (matched skills, domain fit, urgency, skill gaps). |
| **Ask** | Plain-English search ("online AI hackathons closing soon with 1L+ prize"). Rule-based parsing → filters → same ranking engine. No external LLM. |
| **Tracker** | Save listings and move them through saved → applied → shortlisted → won/rejected. |
| **Calendar + API** | `/api/listings/calendar.ics` (day-before alarms) and a public JSON `/api/listings`. |
| **Live data** | Hourly ingestion from 7 platforms (table below). Each source is an independent adapter in `server/services/ingest/sources/`, so one site being down never blocks the rest. Expired listings are purged on every run. |

### Sources
| Platform | What's pulled | Notes |
|---|---|---|
| Unstop | hackathons, competitions (incl. case competitions), quizzes | registration deadline, prize pool, skills, eligibility |
| Devpost | open hackathons | USD prizes converted to ₹ (`USD_TO_INR`) |
| Devfolio | hackathons with applications open | registration close date |
| HackerEarth | hackathons and coding challenges | |
| Codeforces, CodeChef, LeetCode | upcoming contests | deadline = contest start |

These are the public endpoints each site's own pages use; no API keys are needed. Listings link back to the organiser. Respect each site's terms and keep the hourly interval. Add a platform by writing one adapter that returns `{ externalId, title, url, deadline, … }`.

`npm run seed` adds 12 offline sample listings; they are removed automatically after the first successful live ingest.

### Recommendation score (0–100)
`0.35 skills + 0.20 interests + 0.20 TF-IDF text similarity + 0.15 preference fit + 0.10 urgency`.
Weights live in `server/services/recommender.js`. Each result returns its `breakdown` and human-readable `reasons`.

## Run it

Requires Node 20+ and a running MongoDB. The repo-root `.env` (git-ignored) supplies `MONGO_URI` and `JWT_SECRET`; see `.env.example`.

```bash
# API (http://localhost:5050)
cd server && npm install
npm run seed      # optional sample listings
npm start         # also pulls live Devpost listings on boot and hourly

# Web (http://localhost:5173, proxies /api to 5050)
cd client && npm install && npm run dev
```

Tests: `cd server && npm test` (parser, skill matching, recommender, ask parser).

## Layout
```
server/  Express + Mongoose (models, routes, services/{resumeParser,recommender,askParser,ingest})
client/  React + Vite, no 3D/WebGL (~90 KB gzipped JS)
old/     previous HackElite AI project
```

## Verified vs. not
- **Verified:** API flows (register, resume upload → parsed profile, recommendations, ask), live Devpost ingestion, unit tests, production build, page renders without console errors.
- **Not built:** Google sign-in, MLH / ETHGlobal / Hack Club / DoraHacks / Kaggle / Internshala (no stable public JSON endpoint found; they would need HTML scraping or partner access), email/WhatsApp reminders, OpenAPI docs, scanned-image (OCR) resumes.
- **Fragile by nature:** third-party endpoints are unofficial and can change without notice. A broken source shows as `failed: …` in the ingest log and the others keep working.
- **Skill extraction is dictionary-based**, so it misses skills not in `server/services/skills.js`; users can edit the list on the Profile page.

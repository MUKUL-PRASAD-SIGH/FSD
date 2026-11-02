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
| **Live data** | Hourly ingestion of open hackathons from Devpost's public endpoint; `npm run seed` adds 12 clearly-labelled sample listings. |

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
- **Not built:** Google sign-in, listings from the other ~20 platforms Brabble covers (only Devpost is live; others need per-site integrations), email/WhatsApp reminders, OpenAPI docs, scanned-image (OCR) resumes.
- **Skill extraction is dictionary-based**, so it misses skills not in `server/services/skills.js`; users can edit the list on the Profile page.

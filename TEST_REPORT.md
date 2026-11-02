# Test report

_Run on 2 Nov 2026 in the takeover sandbox: Node 22.23.4, MongoDB 8.0.23, Chromium (Playwright). Every number below comes from an actual run._

## Summary

| Suite | Command | Result |
|---|---|---|
| Server: unit, integration, API, ingestion, recommender, parsing | `cd server && npm test` | **54 / 54 pass** (was 24/25 at takeover) |
| Browser journeys (real UI + API + MongoDB) | `node e2e/journeys.js` | **16 / 16 pass**; report in `docs/screenshots/journeys-report.json` |
| Client production build | `cd client && npm run build` | passes (≈103 KB gzipped JS) |
| Dependency audit | `npm audit --omit=dev` (server), `npm audit` (client) | **0 vulnerabilities** in both |
| Integration self-check | `cd server && npm run integrations:check` | MongoDB, JWT OK. Everything else **not configured** (no keys provided) |
| Live source check | `cd server && npm run sources:check` | 14 **failed** (hosts blocked by the sandbox), 2 **skipped** (no keys). See SOURCE_COVERAGE_REPORT.md |

Database safety: tests use the throwaway databases `hackelite_e2e_test` and `hackelite_ingest_test`, which are dropped before and after. Files run one at a time (`--test-concurrency=1`). The browser journeys ran against a local development database holding only sample data and test accounts created by the run.

## Server tests by file

| File | Tests | Covers |
|---|---|---|
| `e2e.test.js` | 16 | Real Express app + MongoDB over HTTP: security headers/CORS/body limits; password policy; register/login/hash; lockout; NoSQL injection and prototype pollution; privilege escalation; Google flow with a **mocked** verifier; password change, logout-all, reset; lister approval → publish → notifications; Free vs Pro gating, resume upload, location ranking, cited assistant, prompt-injection resistance; public API, `.ics`, tracker; account deletion; rate limiting; **integration self-check** (honest "not configured", admin-only, no secret leakage); **source coverage API**; **SERVE_CLIENT CSP** |
| `ingest-pipeline.test.js` | 12 | Date parsing (epochs, offsets, IST/ET/JST, DST, month names, invalid input); every Devpost range form (short, cross-year, en dash); prize parsing (USD/INR/EUR/USDC, K/L/Cr/M, largest wins, bare numbers ignored); validation reasons and expiry; cross-source dedup (merge, no same-feed merging, native beats aggregator, gap filling); HTTP retries (429/503 retried with Retry-After, 404 not retried, network errors, non-JSON); pagination (totalPages, empty page stop, caps, partial results on failure, zero-based); Devpost (3 pages, 25 records → 22 valid, 2 rejected with reasons, 1 expired); Unstop (3 categories, 6 pages, IST); MLH microdata; AtCoder +0900; ETHGlobal Next.js data; JSON-LD; Hack Club eligibility; key-gated sources skipped; runner isolation (ok/failed/partial/skipped with correct counts) |
| `ingest-db.test.js` | 2 | Runner persistence on MongoDB: upsert; seed removal; native source replaces aggregator with `alsoOn`; saved tracker entry follows the merged listing; saved listings never removed as stale; **no stale removal after incomplete pagination**; removal after a complete one; failed source removes nothing; admin-unpublished listings stay unpublished |
| `ingest.test.js` | 5 | Normalisation, open check, money formatting, adapter registry (16 unique sources) |
| `recommender-profiles.test.js` | 10 | Eligibility reader (levels, batches, open, uncheckable conditions). Six profiles: Asha (AI/ML UG, Pune, online only), Rohan (web dev, Bengaluru, travels), Meera (MBA, Mumbai), Kabir (school student, Delhi), Dev (2026 competitive programmer), blank user. Each asserts top picks, hard exclusions and excluded counts. Free tier; 0–100 integer scores with criteria; determinism and input-order independence; no duplicates; saved exclusion |
| `engine.test.js` | 6 | Skill matching word boundaries, resume text parsing, basic ranking, closed/free-only handling, plain-English query parser |
| `resume-pdf.test.js` | 3 | Real PDF (Chromium-rendered fixture), real DOCX fixture, unsupported/empty files |

## Browser journeys (`e2e/journeys.js`)

| # | Journey | Result | Screenshot |
|---|---|---|---|
| 1 | Landing/browse renders listings, stats, filters | pass | `01-browse-desktop.png` |
| 2 | Type filter narrows the list; search works | pass | `02-browse-search-web.png` |
| 3 | Weak password refused; strong password creates a student | pass | `03-register-weak-password.png` |
| 4 | Profile (skills, interests, city/state, education, grad year) persists after reload | pass | — |
| 5 | Free plan: basic picks with reasons and breakdown | pass | `05-for-you-free.png` |
| 6 | Wrong Pro key refused (403), valid key activates Pro | pass | `06-plan-pro-active.png` |
| 7 | PDF resume upload shows extracted skills | pass (after fixing the missing skills list, see below) | `07-resume-parsed.png` |
| 8 | Pro recommendations: 0–100 score, 8-criterion breakdown, AI listing first for an AI/ML profile | pass | `08-for-you-pro-breakdown.png` |
| 9 | Save from browse → tracker → status "applied" persists | pass | `09-tracker.png` |
| 10 | Listing detail page + per-listing `.ics` with a day-before alarm | pass | `10-listing-detail.png` |
| 11 | Assistant answers "online AI hackathons closing soon" with citations (extractive mode) | pass | `11-assistant.png` |
| 12 | Notifications page | pass | — |
| 13 | Lister sign-up; dashboard blocked pending approval | pass | `13-lister-pending.png` |
| 14 | Admin: source coverage table (16 sources, detail row), integrations tab, approve lister | pass | `14a-…`, `14b-…` |
| 15 | Approved lister publishes an event; it appears in browse search | pass | `15a-…`, `15b-…` |
| 16 | Mobile 390 px: no horizontal page scroll on browse, login, For you | pass | `16a–c` |

The one console error in the report is the expected `403` from the deliberately wrong Pro key in journey 6.

**Data caveat:** listings shown in screenshots are the project's **offline sample listings** (`npm run seed`, organisers named "Sample …"), because no live source is reachable from the sandbox.

Production mode was also checked in Chromium: with `SERVE_CLIENT=true`, the built app renders browse, a deep link and login under the page CSP with no CSP violations.

## Bugs found by testing and fixed
- PDF test failure (bad hand-made fixture), now a real fixture.
- Devpost short and cross-year date ranges dropped.
- `Rs. 50000` prize not parsed.
- Dedup merged different editions of an event with the same name.
- Unparseable dates reported as missing.
- An in-person event abroad ranked 4th for a student who doesn't travel.
- A matching graduation batch was "unknown" instead of eligible.
- Resume page didn't list extracted skills.
- `/stats` counted unpublished listings.
- The coverage header counted sample listings as ingested.

## Not covered (and why)
| Area | Why |
|---|---|
| Live ingestion from any source | Hosts blocked by the sandbox network policy; run `npm run sources:check` elsewhere |
| Real Google sign-in | No OAuth client ID provided; needs a browser sign-in by a person |
| Gemini generation and embeddings | No API key; requests confirmed to reach Google, rejected only for the invalid test key |
| SMTP delivery | No credentials, and SMTP is unreachable from the sandbox |
| Kaggle / clist adapters live | No keys |
| Load and performance | Only small datasets (sample data plus fixtures) |
| Cross-browser and accessibility audit | Chromium only; keyboard focus styles and labels exist, but no formal axe/WCAG audit was run |

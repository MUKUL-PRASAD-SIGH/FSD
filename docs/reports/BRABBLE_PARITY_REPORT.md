# Brabble.ai parity report

> **Historical report.** A snapshot from the November 2026 takeover audit, kept for the record. The current state is in [IMPLEMENTATION_STATUS](../IMPLEMENTATION_STATUS.md); the live test suite is described in [TESTING](../TESTING.md).

_2 Nov 2026._

## Status of the comparison: blocked

**Brabble.ai could not be observed.** From this sandbox, connections to `brabble.ai` are refused by the network policy (proxy 403), and the WebFetch tool returns `getaddrinfo ENOTFOUND brabble.ai` for the home page, `robots.txt` and `sitemap.xml`. No login or bypass was attempted.

So this report contains **no claims about how Brabble.ai looks or behaves**. An earlier version of the project described its features from memory; that is not evidence, and is not repeated here. What it does contain:
1. for each module the brief asks about, what HackElite does now, with evidence (tests and screenshots);
2. the observations needed from Brabble.ai for each module, as a checklist;
3. a procedure to fill in the Brabble column using legitimate public access.

## How to complete the comparison (about 1 hour, on any normal machine)

1. Open https://brabble.ai/ in Chrome with DevTools → Network ("Preserve log", filter Fetch/XHR).
2. For each module in the table below, use the product as a normal visitor or user. Sign up with your own account; do not use anyone else's. Record:
   - a screenshot of each UI state: empty, loading, results, error, mobile at 390 px;
   - the request URLs and response shapes behind discovery, search and recommendations. This is especially useful for coverage: if Brabble lists a source we don't ingest, its listings will show it;
   - the fields on an opportunity card and its detail page;
   - filter and sort options, and Free vs Pro differences (pricing page).
3. Optional, with REA (installed per TAKEOVER_AUDIT.md):
   ```bash
   rea analyze-web-bundle https://brabble.ai/ --json > brabble-bundle.json
   rea capture-browser-scenario --help
   ```
   This statically analyses the public JavaScript bundle (routes, API calls, feature flags) and records a bounded browser scenario as evidence. Only public pages, and only your own account for anything behind login.
4. Fill in the "Brabble.ai (observed)" column, then turn each difference into an issue.

## Module checklist

Legend for **HackElite status**:
- ✅ implemented and verified here (test or browser journey)
- 🟡 implemented, not externally verified
- ⬜ not implemented

| # | Module | HackElite today | Status | Evidence | Brabble.ai (observed) | Observations to collect |
|---|---|---|---|---|---|---|
| 1 | Landing page and navigation | Hero with value statement, live stats (open now, closing this week, prize money, platforms), CTAs, filters on the same page; nav: Browse, For you, Ask, Assistant, Tracker, role pages; theme toggle; footer with .ics and JSON API | ✅ | `01-browse-desktop.png`, journey 1 | _not observed_ | Headline and claims, section order, CTA targets, nav items, footer, typography and colours |
| 2 | Browse / discovery | Paginated grid ("Show more"), 16 sources merged and de-duplicated, attribution "also on …" | ✅ (sample data) / 🟡 live sources | journeys 1–2, `ingest-*.test.js` | _not observed_ | Number of listings shown, sources named, infinite scroll vs pages, default sort |
| 3 | Opportunity cards and detail pages | Card: deadline chip (closes / starts), type, verified-lister badge, match score /100, organiser · platform · also on, mode/city, prize (original currency, ₹ estimate), fee, team size, reasons, "Why this score?", Save, Register. Detail page `/listing/:id` with dates, format, prize, entry, team size, registered count, eligibility, skills, themes, description, calendar export | ✅ | `08-…`, `10-listing-detail.png`, journey 10 | _not observed_ | Card fields and order, detail page sections, share or apply flow |
| 4 | Search, filters, sort | Free-text (title, organiser, tags), type, platform (with counts), mode, free only, closing this week, min prize (API), city (API); sort by deadline, prize or popularity; plain-English "Ask" page | ✅ | journey 2, `engine.test.js` | _not observed_ | Filter categories, multi-select, location filter UI, saved searches |
| 5 | Recommendation engine | Free: 0.45 interests + 0.35 skills + 0.20 urgency. Pro: 8-criterion rubric with penalties. Both: hard filters (expired, ineligible, duplicate, saved), deterministic, 0–100, reasons + per-criterion points and explanation | ✅ | `recommender-profiles.test.js` (6 profiles), journeys 5 and 8 | _not observed_ | How scores are shown (% / label), explanation depth, cold-start behaviour |
| 6 | Login and registration | Email/password with live strength meter and server policy, lockout, Google button (ID-token verification), forgot/reset, lister sign-up path | ✅ password / 🟡 Google (mock-tested only) | journey 3, `e2e.test.js` | _not observed_ | Providers offered, onboarding steps after sign-up |
| 7 | Profile and preferences | Skills, interests (domains), city/state, education level, graduation year, preferred modes/types, free-only, travel, min prize, notification threshold, college, bio, links | ✅ | journey 4 | _not observed_ | Onboarding questionnaire, which preferences exist |
| 8 | Resume upload and skill extraction | PDF/DOCX/TXT (5 MB, magic-byte check), parsed in memory; skills (≈50-skill dictionary), domain strengths, graduation year, signals; skills merged into profile; chunks embedded for RAG | ✅ | `resume-pdf.test.js` (PDF + DOCX), journey 7, `07-resume-parsed.png` | _not observed_ | Formats accepted, what is extracted and shown, editability |
| 9 | Free vs Pro | Pro by activation key (no billing); gated endpoints return 402 | ✅ / ⬜ payments | journey 6, `e2e.test.js` | _not observed_ | Prices, limits per tier, trial, payment provider |
| 10 | Location-aware recommendations | City/state/country fit, preferred cities, travel willingness, hybrid handling, abroad penalty | ✅ | `recommender-profiles.test.js`, `e2e.test.js` (Pune beats Guwahati) | _not observed_ | Distance radius vs city match, map UI |
| 11 | AI assistant / RAG | Constraint parsing → retrieval over MongoDB-stored embeddings → rubric re-rank → cited answer; extractive without a key, Gemini 2.5 Flash with a key | ✅ extractive / 🟡 Gemini (no key) | journey 11, `e2e.test.js` | _not observed_ | Chat UX, citations, memory, suggested prompts |
| 12 | Application tracker | Kanban statuses: saved → applied → shortlisted → won/rejected, notes | ✅ | journey 9 | _not observed_ | Statuses, reminders per item, export |
| 13 | Calendar and reminders | `.ics` feed (all or filtered), per-listing `.ics` with a day-before alarm; deadline notifications 48 h before for saved items | ✅ | journey 10, `e2e.test.js` | _not observed_ | Google Calendar sync, reminder channels |
| 14 | Admin and lister | Lister sign-up → admin approval → event template with validation → publish/edit/unpublish; admin: users, plans, roles, listings moderation, audit log, notifier, **source coverage dashboard**, **integration checks** | ✅ | journeys 13–15, `14a/14b` screenshots | _not observed_ | Organiser features (analytics, featured listings), moderation |
| 15 | Notifications | In-app bell + page (new matches above threshold, closing deadlines, approvals); optional email digest | ✅ in-app / 🟡 email (no SMTP) | `e2e.test.js`, journey 12 | _not observed_ | Channels (email, push, WhatsApp), frequency controls |
| 16 | Responsive / mobile | Single-column at 390 px, no horizontal page scroll (checked), wide admin tables scroll inside their container | ✅ | journey 16, `16a–c` screenshots | _not observed_ | Native app?, bottom navigation, PWA |

## Known differences that do not depend on observing Brabble

These are gaps a mature product in this category would close regardless of what Brabble does:
- **Billing:** Pro uses activation keys. A payment provider (Razorpay/Stripe webhook) is needed for a real product.
- **Email verification** for password sign-ups is not built.
- **Skill extraction** is dictionary-based (~50 canonical skills). A larger taxonomy or model-based extraction would help.
- **Semantic matching** uses a local hashed bag-of-words model unless Gemini embeddings are enabled.
- **Live data:** see SOURCE_COVERAGE_REPORT.md. Sixteen adapters exist, but this sandbox could verify none of them live.

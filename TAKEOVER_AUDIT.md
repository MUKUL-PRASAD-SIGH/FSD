# Takeover audit

_Audit date: 2 Nov 2026. Branch `claude/hackelite-ai-takeover-52nqbg`, starting from `7b536ab` (merge of PR #3)._
_Everything marked "verified" below was run in this session. Anything else says why it could not be._

## 1. Environment set up for the takeover

| Tool | Version | How | Verified by |
|---|---|---|---|
| Node.js / npm | 22.23.4 / 10.9.9 | preinstalled | `node -v` |
| Git | 2.43.0 | preinstalled | — |
| Python | 3.13 | preinstalled | — |
| JDK | OpenJDK 21.0.12 (full JDK, `javac` present) | preinstalled | Ghidra launcher |
| MongoDB | 8.0.23 | conda-forge build (MongoDB's own download servers are blocked from this sandbox) | `mongod --version`; server started; all DB tests pass |
| Ghidra | 12.1.4 | official GitHub release zip | headless import + analysis of a test ELF: `Import succeeded`, `Analysis succeeded` |
| REA (`rea-agents`) | 6.8.0 | `npm install -g rea-agents` (repo also cloned from github.com/morluto/rea) | `rea doctor` reports Ghidra healthy; `rea decompile /tmp/hello add --provider ghidra` returned `int add(int param_1,int param_2) { return param_2 + param_1; }` |
| Chromium + Playwright | preinstalled | — | 16 browser journeys (see TEST_REPORT.md) |

Reproducible with `scripts/setup-dev-tools.sh` (then `source /opt/tools/env.sh && start_mongo`).

Issues met while installing:
- **Ghidra 12.2 needs JDK 25**; REA 6.x supports Ghidra **12.1.x**, so 12.1.4 was installed instead.
- Ghidra's launcher could not parse the JDK version because `JAVA_TOOL_OPTIONS` prints a banner; fixed by setting `JAVA_HOME_OVERRIDE` in `support/launch.properties` (the setup script does this).
- `github.com/.../releases` HTML is blocked but release asset downloads work; the asset name was found from the tag date.

**Where REA/Ghidra were used:** only to verify the toolchain. Brabble.ai is a website, so binary analysis does not apply. REA's web-capture tools need network access to the target, and brabble.ai is unreachable from this sandbox (see §4).

## 2. Repository state at takeover

- Working tree clean; branches `main` and the designated branch, both at `7b536ab`.
- Layout: `server/` (Express + Mongoose), `client/` (React + Vite), `docs/` (ARCHITECTURE, SECURITY), `old/` (previous project, untouched), `backend/logs` (left over from the old project).
- ~4,600 lines across server and client.

## 3. Actual status found (vs. the previous IMPLEMENTATION_STATUS.md)

| Claim in the old status file | What I found |
|---|---|
| "25 tests, 25 pass" | **24/25.** `resume-pdf.test.js` failed with `bad XRef entry`. The parser was fine (a Chromium-rendered PDF parsed correctly); the test's hand-built PDF had an xref table that pdf.js 1.10 rejects. **Fixed**: the test now uses a real PDF fixture. |
| "Devpost date parsing fixed for short ranges" | **Not fixed.** The regex still required `Mon DD, YYYY` at the end, so `Nov 03 - 15, 2026` returned null and the listing was dropped. Cross-year ranges (`Dec 28 - Jan 03, 2027`) were also lost. **Fixed** in `services/ingest/parse.js`, with tests. |
| "Devpost pagination fixed" | Partly true: it looped up to 30 pages but asked only for `status=open` (no upcoming) and never checked `meta.total_count`, so it could not tell whether it had seen everything. **Fixed.** |
| Unstop "every page" | Hard caps (30/40/10 pages) silently truncated large categories. **Fixed**: caps raised and reported as `capped` when reached. |
| 7 sources | True, but MLH, ETHGlobal, Hack Club, DoraHacks, Kaggle, AtCoder, Topcoder and GfG were missing. **9 adapters added** (16 total). |
| DOCX parsing "verified by hand once" | No automated test existed. **Added** a real DOCX fixture and test. |
| Gemini integration | Code targeted `gemini-2.0-flash` and `text-embedding-004`, both retired by Google. **Updated** to `gemini-2.5-flash` and `gemini-embedding-001`. Still unverified (no key). |
| `.gitignore` | Contained unresolved merge-conflict markers. **Fixed.** |
| `/api/listings/stats` | `open` and `closingWeek` counted unpublished listings. **Fixed.** |

Other problems found and fixed:
- No validation or rejection reasons: records with a bad date or URL disappeared without trace.
- No cross-source dedup: the same hackathon on Devfolio and Unstop appeared twice.
- Expired or cancelled events lingered until their deadline, because nothing removed listings a source stopped returning.
- The recommender let a high-school-only event reach a college student, and treated an in-person event in Boston like one in Mumbai for an Indian student who "travels".
- The resume UI never showed the extracted skills.

## 4. Blockers outside the code

| Blocker | Effect | Who can unblock |
|---|---|---|
| Sandbox network policy denies **brabble.ai** and **every listing source** (devpost.com, unstop.com, api.devfolio.co, hackerearth.com, codeforces.com, codechef.com, leetcode.com, mlh.io, hackathons.hackclub.com, ethglobal.com, dorahacks.io, kaggle.com, atcoder.jp, api.topcoder.com, geeksforgeeks.org, clist.by). The WebFetch tool could not resolve them either. | No live ingestion, no live Brabble comparison from here. Adapters are tested against constructed fixtures. | Owner: run `cd server && npm run sources:check` on a normal machine, or allow these domains in the cloud environment's network settings. |
| No credentials provided (no `.env` in the repo, correctly). | Google OAuth, Gemini, SMTP, Kaggle, clist not verified end to end. | Owner: follow ENV_SETUP_GUIDE.md, then `npm run integrations:check`. |
| SMTP ports blocked from the sandbox. | Email cannot be tested here even with credentials. | Test on a normal machine. |
| Git push to `mukundgaur06/FSD_PROJ` refused (Claude GitHub App has no access). | Commits exist locally on the branch only. | Owner: reconnect GitHub / install the Claude GitHub App on the repo. |

## 5. What was done (commits on this branch)
1. `.gitignore` fix, real PDF fixture, dev-tool setup script.
2. Ingestion rebuild: HTTP retry/backoff/pagination, timezone-aware dates, multi-currency prizes, validation with reasons, cross-source dedup, sync history, 9 new adapters, admin coverage API, live check script.
3. Recommender: hard eligibility filter, country-aware location, deterministic ordering, per-criterion breakdown, profile tests.
4. Gemini model update and real integration self-checks (CLI + admin API).
5. UI: score breakdown, listing detail page, source coverage dashboard, integrations tab, skeleton/error states, mobile fixes, 16 browser journeys with screenshots.
6. Documentation (this file, BRABBLE_PARITY_REPORT, SOURCE_COVERAGE_REPORT, IMPLEMENTATION_STATUS, TEST_REPORT, ENV_SETUP_GUIDE, README).

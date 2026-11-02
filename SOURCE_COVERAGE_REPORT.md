# Source coverage report

_2 Nov 2026._

> **Read this first.** None of the listing sites can be reached from the sandbox this work was done in. The network policy denies the connections, and the WebFetch tool could not resolve the hosts either. So **no adapter has been run against a live site in this session**, and no live listing counts are claimed here. Each adapter is tested against constructed fixtures (`server/tests/fixtures/sources.js`). For the original seven adapters, the fixtures use the field names they read when they last ran live (366 listings, per the previous status file).
>
> To get real numbers, run this on any machine with normal internet access. It needs no database:
> ```bash
> cd server && npm run sources:check              # coverage table per source
> cd server && npm run sources:check -- --record  # also saves raw responses to tests/fixtures/live/
> ```
> After the app has been running, **Admin → Sources** shows the same numbers per sync, with history.

## 1. Last run in this sandbox (honest output)

`npm run sources:check`, 2 Nov 2026:

| source | status | note |
|---|---|---|
| devpost, unstop, devfolio, hackerearth, codeforces, codechef, leetcode, mlh, hackclub, ethglobal, dorahacks, atcoder, topcoder, geeksforgeeks | failed | `ENOTFOUND` / proxy 403: host not allowed in this sandbox |
| kaggle | skipped | needs `KAGGLE_USERNAME` and `KAGGLE_KEY` |
| clist | skipped | needs `CLIST_USERNAME` and `CLIST_API_KEY` |

Each failure was isolated: the runner finished, recorded a `failed` SourceSync row per source, and left existing listings untouched (see the `14a-admin-source-coverage.png` screenshot).

## 2. Sources

Confidence levels:
- **A**: documented or previously run live; schema known.
- **B**: public endpoint used by the site's own front end; field names from prior knowledge, unverified here.
- **C**: HTML or embedded-data parsing with tolerant fallbacks; most likely to need adjustment after the first live run.

| # | Source | Adapter | Interface | Pagination | Deadline used | Prize | Confidence | Access |
|---|---|---|---|---|---|---|---|---|
| 1 | Unstop | `unstop.js` | JSON `api/public/opportunity/search-result` (hackathons, competitions, quizzes) | `data.last_page` per category; cap 150 pages each, reported if reached | registration end (`regnRequirements.end_regn_dt`, IST) → start → end | sum of `prizes[].cash` (INR) | A | public, no key |
| 2 | Devpost | `devpost.js` | JSON `api/hackathons?status[]=open&status[]=upcoming` | `meta.total_count / per_page`; stop on empty page | end of `submission_period_dates` (Eastern time), all range forms | parsed from `prize_amount` (USD) | A | public, no key |
| 3 | Devfolio | `devfolio.js` | JSON `api.devfolio.co/api/hackathons?filter=application_open` and `upcoming` | `pages` | `hackathon_setting.reg_ends_at` → start → end | parsed if present | A (open) / B (upcoming filter) | public, no key |
| 4 | HackerEarth | `hackerearth.js` | JSON feed used by its browser extension | single response | hackathons: end; contests: start | — | A | public |
| 5 | Codeforces | `contests.js` | official API `contest.list` | single response | start time | — | A | public API |
| 6 | CodeChef | `contests.js` | JSON `api/list/contests/all` | single response | future: start; ongoing: end | — | A | public |
| 7 | LeetCode | `contests.js` | GraphQL `upcomingContests` | single response | start time | — | A | public |
| 8 | MLH | `mlh.js` | season page HTML with schema.org microdata; JSON-LD fallback | current season, plus next season Apr–Jun | event start (no registration deadline published) | — | C | public HTML |
| 9 | Hack Club | `hackclub.js` | JSON `hackathons.hackclub.com/api/events/upcoming` | single response | event start | — | B | public, documented |
| 10 | ETHGlobal | `ethglobal.js` | Next.js `__NEXT_DATA__` → JSON-LD → `/events/<slug>` cards; summits skipped | single page | event start | — | C | public HTML |
| 11 | DoraHacks | `dorahacks.js` | JSON `dorahacks.io/api/hackathon/` (ongoing + upcoming), DRF-style `next` | `next` / `count` | registration field if present, else end time | parsed (USD/USDC) | B/C | public |
| 12 | Kaggle | `kaggle.js` | **official API** `api/v1/competitions/list` | pages of 20 until short page | final submission deadline | `reward` (USD) | A (schema) | **needs free API token** |
| 13 | AtCoder | `atcoder.js` | HTML table `#contest-table-upcoming` (+0900 times) | single page | start | — | B | public HTML |
| 14 | Topcoder | `topcoder.js` | public v5 API `challenges?status=Active&currentPhaseName=Registration` | `perPage=100` until short page | `registrationEndDate` | placement prizes (USD) | B | public API |
| 15 | GeeksforGeeks | `geeksforgeeks.js` | JSON behind geeksforgeeks.org/events (upcoming only) | page 1 (upcoming list is short) | start (IST) | — | C | public |
| 16 | clist.by | `clist.js` | **official API v4** `contest/?upcoming=true` | `limit=500`, offset, `meta.total_count` | start (UTC) | — | A | **needs free API key** |

Covered indirectly or not covered:
- **University hackathons** (HackMIT, TreeHacks, IIT/NIT fests and similar) almost all publish on Devfolio, Devpost, MLH or Unstop, which are covered. There is no single public feed for "university portals". Individual sites could be added as small HTML adapters once someone lists which ones matter.
- **clist.by** adds 200+ judges and contest sites (HackerRank, TopCoder SRMs, Kick Start-style and university contests) once a free key is set. Contests from sites we already ingest natively are filtered out, and dedup removes the rest.
- **Not integrated:** Internshala (no public feed found), HackerRank (contests come via clist), CTFtime (possible future adapter: it has a public JSON API at `ctftime.org/api/v1/events/`), Google/Meta competitions (discontinued or via clist).

## 3. Validation rules (why a record is rejected)

`server/services/ingest/validate.js`. A record is **never** rejected for missing optional fields such as prize, city, skills, eligibility or mode. Those get neutral defaults, and the record lists what was inferred (for example `deadline from event start`).

| Outcome | Reason code | Rule |
|---|---|---|
| rejected | `missing_title` | empty title |
| rejected | `invalid_url` | no http(s) URL a student could follow |
| rejected | `missing_date` | no deadline, start date or end date at all, so we cannot tell if it is open |
| rejected | `unparseable_date` | a date was given but cannot be understood (the raw text is kept so this is visible) |
| rejected | `implausible_date` | deadline more than 2 years away (placeholder data) |
| expired | — | deadline already passed: counted, not stored |
| duplicate | — | same `externalId` twice in one feed, or the same opportunity on another source (merged, `alsoOn` attribution kept) |

Deadline choice, in order: the stated registration or submission deadline, then the event start (you must be in before it begins), then the event end. Adapters whose events can be joined mid-way (CodeChef long contests, Kaggle, DoraHacks) pass an explicit deadline.

Timezones: offsets in the data are honoured. Times without an offset are read in the source's zone (Unstop/Devfolio/CodeChef/GfG IST, Devpost ET, AtCoder JST, clist UTC).

## 4. De-duplication

`server/services/ingest/dedupe.js`. Two records are the same opportunity if:
- their canonical URLs are equal (host without `www`, no tracking parameters, no trailing slash), or
- they come from **different** sources, their normalised titles are equal (years, punctuation and "the/edition/official" removed), and their start dates are within 3 days (or deadlines within 10 days when a start date is missing).

The primary record comes from the native source over the aggregator, then the most complete record. Gaps in it are filled from the duplicate. Users' tracker entries on a merged record move to the primary.

## 5. Reliability

- Each adapter runs isolated (`Promise.allSettled`). A failure is recorded as `failed` (nothing fetched) or `partial` (records fetched before the failure are kept).
- HTTP: 20 s timeout and 3 retries with exponential backoff on network errors, 429 and 5xx. Retry-After is honoured; 4xx is never retried. There is a 400 ms gap between calls to the same host. All of these can be set with `INGEST_*` env vars.
- Stale removal: listings a source no longer returns are removed **only after a complete paginated sync**, and never if someone has saved them.
- Admin-unpublished listings stay unpublished across re-ingests.

## 6. Coverage dashboard

**Admin → Sources** (`GET /api/admin/sources`) shows, per source:
- status of the last run, last successful sync, live listings stored
- raw, valid, expired, duplicates and rejected counts
- pages fetched / expected, with complete, capped or incomplete
- rejection reasons with up to 10 sample records, and errors
- a per-source or full **Sync now** (`POST /api/admin/ingest/run`)

`GET /api/admin/sources/:source/history` returns the last 30 runs. Sync records are kept for 90 days.

Counts are never inflated: duplicates are merged rather than stored, and expired or rejected records are counted but not stored.

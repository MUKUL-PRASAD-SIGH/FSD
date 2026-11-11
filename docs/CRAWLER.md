# Event crawler and question analytics: policy and design

HackElite's per-event agent ("Ask about this hackathon") reads an event's own website on demand. This page states exactly
what it does, what it refuses to do, and how personal data is protected. It is an engineering policy, **not legal advice**:
have counsel review it (and your privacy policy) before launch, especially for users in the EU/UK (GDPR) or India (DPDP Act).

## What the crawler does
| Step | Rule |
|---|---|
| **Trigger** | Only when a signed-in user asks a question about that event. There is no background mass crawling. |
| **Scope** | The event's own URL plus up to **6** same-host pages whose link or URL looks like an official info page (FAQ, rules, schedule, prizes, judging, eligibility, timeline, updates, about). Depth 1. |
| **Politeness** | Honours `robots.txt` for **every** URL (our agent `HackEliteBot`, then `*`), including `Crawl-delay` (capped at 5 s). Minimum **1 s** between requests to a host. 12 s per request, 1.5 MB per page, 40 s per crawl. |
| **Identity** | Honest `User-Agent: HackEliteBot/1.0 (...)`. Site owners can block it with `User-agent: HackEliteBot` / `Disallow: /` in `robots.txt`; the block takes effect on the next crawl (robots cache is 1 h). |
| **Caching** | A crawl is cached in MongoDB for 6 h (10 min after a failure), so repeat questions never re-hit the site. |
| **Output** | Short passages and published Q&A (schema.org `FAQPage`/`QAPage`, `<details>`, `<dl>`, "question?" headings). Answers cite the page URL and link back to the organiser, which keeps the traffic with them. |

## What it refuses to do
- No logins, paywalls, CAPTCHAs or bot walls. A `401/403/405` simply ends that page (Devpost currently answers 403: we do not work around it).
- No participant-generated content: forums, discussions, comments, community, participants/attendees, member profiles, project galleries, submissions, chat and similar paths are never fetched, because they contain other people's personal data and are usually outside what the organiser published.
- No off-site links, downloads (PDF, images, archives) or non-public addresses (see SSRF controls in SECURITY.md).
- No browser fingerprint spoofing or IP rotation.
- Emails, phone numbers, URLs, @handles and long numbers found in page text are masked before storage.

## "User queries about a hackathon": what is collected, and what is not
There are three separate things, deliberately kept apart:

1. **Your own history (private).** The questions you ask an event's agent and the answers are saved so the chat survives a refresh. Stored with your user id, readable **only by you** (`GET /api/listings/:id/ask/history`), deletable with one click, auto-deleted after 180 days and removed when you delete your account.
2. **Anonymous community tally (aggregate).** If you have not opted out, the *bare question* is counted toward "what people ask about this event". Stored as `(event, normalised key, scrubbed text, count)` with **no user id, IP or session**. Questions containing personal data (email, phone, link, handle, long number) are never shared. Others only see questions asked **2 or more times**. Opt out any time in the panel (`privacy.shareQuestions`); the default is on, with the disclosure shown next to the toggle. Change the default in `models/User.js` if your counsel prefers opt-in.
3. **Organiser insight.** The approved lister who created an event (and admins) can open **Questions** on their dashboard to see the aggregated, anonymous list with counts. They never see who asked.

Not built, on purpose: tracing individual users' queries, exposing one user's questions to another, or scraping participants' discussions from other sites.

## Operating it responsibly
- Put a contact address and a one-paragraph description of the bot on a public page and add its URL to `UA` in `server/utils/safeFetch.js`.
- Honour takedown/opt-out requests promptly: delete the event's `listingpages` document and add the host to a blocklist if asked.
- Disclose the anonymous tally and crawling in your privacy policy; keep Gemini disclosure (page text is sent to Google when `GEMINI_API_KEY` is set).
- Review each platform's terms before enabling the agent for it; some platforms prohibit automated access even to public pages. Add such hosts to a blocklist.

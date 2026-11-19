# Production readiness report

*Reviewed 19 November 2026, branch `feature/social-network-teams-chat`. Scope: security, privacy, data quality, scaling, operations and onboarding, judged against "strangers can sign up and use it".*

## Verdict

**Ready for a soft launch (invite-only beta) once the five blockers below are done.** The application layer is in good shape: authentication, authorisation, input handling, privacy separation and AI guardrails are implemented and tested. What is missing is mostly around the application: paid-tier infrastructure, legal text, monitoring and a few hardening steps.

| Area | State |
|---|---|
| Authentication and sessions | ✅ strong (bcrypt 12, lockout, breach check, revocable JWT, Google sign-in) |
| Authorisation | ✅ server-side on every route; admin-only routers; ownership checks |
| Input and injection | ✅ NoSQL/prototype-pollution sanitising, body limits, SSRF guard, escaped output |
| Privacy | ✅ resume never stored, usage opt-out, per-user isolation, full account erasure |
| AI safety | ✅ user AI cannot reach admin data (tested import graph + guardrail); admin AI uses fixed queries only |
| Secrets | ✅ none in any branch or on GitHub; secret scan in CI (one local-only ref, see below) |
| Dependencies | ✅ `npm audit --omit=dev`: 0 vulnerabilities (server and client) |
| Data quality | ✅ new: automatic listing checks, user reports, admin review queue + email alerts |
| Onboarding | ✅ new: game-like setup that only asks what the recommender is missing; Bengaluru college directory |
| Monitoring, backups | ❌ none yet |
| Scale beyond one server | ⚠️ works for one instance; clear path documented below |
| Legal pages | ⚠️ written, with placeholders for your entity and contacts |

## Blockers before inviting the public

1. ~~**Run the full test suite once.**~~ ✅ Done in CI on 19 November 2026 (PR #1): 137 tests, 136 pass, 0 fail, 1 skipped (SPA test that needs a built client in that job), plus the live end-to-end journey (41/41 checks), dependency audit, client build and Docker image build.
2. **Real hosting tier.** Render's free plan sleeps after inactivity (first request after sleep takes tens of seconds) and Atlas M0 is a shared 512 MB cluster without backups. For real users: a paid always-on instance, and an Atlas tier with backups.
3. **Atlas network access for the host.** You allowed your own IP. The hosting provider connects from different addresses, so either add its outbound IPs or use `0.0.0.0/0` with a long, unique database password and a database user limited to this one database.
4. **Email on your own domain.** Password reset, verification and admin alerts all need email, and production now refuses to start without `SMTP_URL`. Gmail SMTP works but has low daily sending limits and weak deliverability. Use a transactional provider (Brevo, Resend, Amazon SES) with SPF/DKIM on your domain.
5. **Legal text.** Replace the `[bracketed]` placeholders on `/privacy` and `/terms` (entity name, contact email, hosting region, jurisdiction) and have them reviewed. India's DPDP Act 2023 applies to personal data of people in India.

## Information-leak review

| Check | Result |
|---|---|
| Secrets in tracked files | none (`npm run secrets`, now also in CI) |
| Your real `.env` values in any branch, tag or GitHub ref | none (checked `MONGO_URI`, `SMTP_URL`, `JWT_SECRET`, `PRO_ACTIVATION_KEYS`, `GEMINI_API_KEY`, `CLIST_API_KEY`, `KAGGLE_KEY`) |
| Local-only git ref `refs/agents/9e74be45…/checkpoints/turn/0` | ⚠️ commit `50ce8c0` contains a file named `env` with your **real Gmail SMTP app password, JWT secret and Pro key**. It is not on any branch and not on GitHub, but `git push --mirror` or `git push --all`-style tooling could publish it. **Delete the ref** (`git update-ref -d refs/agents/9e74be45-a6fe-48e7-9c93-9dc145c3bfbc/checkpoints/turn/0`, then `git gc --prune=now`) and, as a precaution, **rotate the Gmail app password** (rotating `JWT_SECRET` signs everyone out) |
| `.gitignore` gap | fixed: a file named `env` (no dot) was not ignored; now `env`, `*.env`, `*.pem`, `*.key`, `*.p12`, `serviceAccount*.json` are |
| API responses | password hashes, reset/verify tokens, calendar tokens and resume text are never serialised; admin analytics strip credential-like fields and never include message text or private AI history (tested) |
| Error responses | 5xx responses are generic; stack traces only go to server logs |
| Health endpoint | `/api/health` exposes only `ok`, time and whether the DB is local; never the connection string |
| Public data by design | the listings JSON API and the college list (including names users added) are public |
| Logs | access logs contain paths (which can include listing or room ids) but no bodies or tokens; admin promotion logs the email address |

## Security controls added in this round

- **Admin by verified email** (`ADMIN_EMAILS`): mukulprasad958@gmail.com is the main admin; it becomes admin on its first sign-in with a verified email, so nobody can claim admin by registering that address.
- **Production config gate**: refuses to start without `SMTP_URL` and an `https://` `APP_URL`; no longer requires Pro keys while plans are off; still refuses a short `JWT_SECRET` or `CLIENT_ORIGIN=*`.
- **Secret scanning** in CI and `npm run secrets`.
- **Moderated shared data**: user-added colleges are validated, rate-limited, deduplicated and queued for admin review.
- **Listing reports** are signed-in only, one open report per person per listing, and admin alert email is capped.

## Remaining risks (not blockers, plan for them)

| Risk | Why it matters | Fix |
|---|---|---|
| JWT in `localStorage` | an XSS bug would expose sessions | httpOnly + SameSite cookies with CSRF tokens |
| No CAPTCHA | bot sign-ups and credential stuffing (rate limits and lockout only slow them) | Cloudflare Turnstile on sign-up and login |
| Soft email verification | unverified accounts can message and join teams | require verification for chat, teams and listing reports |
| No chat moderation | abuse in DMs or rooms can only be blocked, not reported | report message + admin review, delete own message |
| No monitoring | outages and errors go unnoticed | uptime monitor on `/api/health/ready`, error tracking (Sentry), Atlas alerts |
| No backups | data loss on an Atlas M0 incident | Atlas tier with continuous backups, or scheduled `mongodump` |
| Usage tracking is opt-out | some laws require opt-in consent | flip `privacy.shareUsage` default to `false` if needed |
| Gemini sends data to Google | user AI sends listing text and resume excerpts; admin AI sends analytics rows | disclose it (the Privacy page does), or keep Gemini off |

## What could hinder scaling

| Limit today | When it bites | Fix |
|---|---|---|
| Rate limits are in process memory | as soon as you run 2+ instances (each instance has its own counters) | Redis store for `express-rate-limit` |
| Socket.IO has no adapter | 2+ instances: users on different instances don't see each other's live messages | `@socket.io/redis-adapter` + sticky sessions |
| Ingest, reminders, notifier and quality scans run in every instance | 2+ instances: duplicate syncs and duplicate reminder emails | run jobs in one worker (or a lock in MongoDB) |
| Recommendations load every open listing with embeddings per request | thousands of listings × many concurrent users: memory and CPU | Atlas Vector Search, cache per-user results for a few minutes |
| Admin analytics aggregate raw events on demand | millions of events: slow dashboard | nightly roll-up collection; events already expire after 180 days |
| Free hosting tiers | any real traffic | see blockers 2-3 |
| Gmail SMTP | a few hundred emails a day | transactional email provider |

## Twilio and SMS

**Twilio is now integrated** (switched off until you add keys): phone verification with Twilio Verify, SMS or WhatsApp reminders 1 day and 3 hours before tracked deadlines, a per-user daily cap, and a signed STOP/START webhook. Setup: [ENV_SETUP.md, section 4b](ENV_SETUP.md#4b-sms-and-whatsapp-reminders-twilio_-optional). The notes below still apply before you switch it on.

It can be connected to hackathons, and the natural uses are:
- deadline reminders by SMS or WhatsApp for events in a user's tracker (the reminder scheduler already exists, so this is a new delivery channel, not a new system),
- phone verification at sign-up (Twilio Verify) to cut bot accounts,
- "your team invite is waiting" and "registration closes in 3 hours" nudges.

Before building it, two decisions are yours:
1. **India's DLT rules.** Promotional or transactional SMS to Indian numbers requires DLT registration of your business, sender ID and message templates with an Indian telecom operator. Twilio supports India but you still register. WhatsApp (via Twilio or an Indian provider like MSG91 or Gupshup) needs template approval instead and is often the easier first channel.
2. **Cost and consent.** Every message costs money, so SMS should be opt-in per user with a clear stop option and quiet hours.

Still open: delivery-status callbacks (to spot failed texts) and quiet hours.

## Feature ideas worth rolling out next

Ranked by impact for a new platform that needs to grow:

1. **Campus ambassadors and college leaderboards.** You now know every user's college: show "47 students from RVCE are on HackElite", rank colleges by wins and participation, and give ambassadors a referral link. This is the strongest growth loop for a student platform.
2. **Referral invites.** "Invite 3 friends, get featured on the leaderboard" fits the team-up flow you already have.
3. **WhatsApp deadline reminders** (see Twilio above), which students actually read.
4. **Post-event wins and portfolio.** Let people mark "won", "finalist", "submitted" with a project link; public profile pages become a hackathon CV (and great SEO).
5. **Organiser analytics.** Show listers their views, Register clicks and saves (the data already exists in the analytics model); that is what makes organisers list directly with you.
6. **Weekly personalised digest email** with the top 5 new matches, already ranked by the recommender.
7. **Team-finder board per hackathon**: "looking for a designer for X", built on the existing teams and discovery.
8. **Mentor and judge marketplace**: experienced people offer office hours to teams.
9. **Verified college email badge** (`@rvce.edu.in` etc.) for trust and for college-only events.
10. **Progressive web app** with push notifications, so mobile users get deadline alerts without SMS costs.

## Name suggestions

Unverified for trademarks, domains and app-store names; check before committing to one.

| Name | Why it fits |
|---|---|
| **SprintScout** | hackathons are sprints, and the product scouts the right ones for you. Clear, professional, easy to say |
| **Kairo** | from *kairos*, the Greek for "the right moment": catching the right opportunity at the right time. Short and brandable |
| **BuildBeacon** | a beacon that guides builders to the next event; works well with a lighthouse logo |
| **Questlane** | your lane of quests (events), with a progression and gamified feel |
| **ForgeFinder** | find where to forge your next project; slightly playful |

**Recommendation:** *SprintScout* if you want people to understand the product from the name, *Kairo* if you want a short brand you can grow beyond hackathons.

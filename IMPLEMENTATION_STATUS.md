# Implementation status

_Last verified: 2 Nov 2026. Everything below was run, not assumed. "Needs external" items are the only things I could not run end to end, and each one lists exactly where to get what is missing._

## 1. At a glance

| Area | Implemented | Tested | Running now |
|---|:--:|:--:|:--:|
| Email + password sign-up / sign-in, password policy, lockout | ✅ | ✅ automated + browser | ✅ |
| Google sign-in (ID-token verification, account linking) | ✅ | ⚠️ automated with a mocked Google verifier only | ⏸ needs `GOOGLE_CLIENT_ID` |
| Roles: user / lister / admin, route guards | ✅ | ✅ automated + browser | ✅ |
| Lister sign-up → admin approval → publish via event template | ✅ | ✅ automated + browser (approval, form render) | ✅ |
| Notifications (new matches, closing deadlines, approvals) | ✅ in-app | ✅ automated | ✅ |
| Notification **email** digests / password-reset emails | ✅ code | ⚠️ not sent anywhere | ⏸ needs `SMTP_URL` |
| Free plan (browse, save, calendar, basic picks, plain-English search) | ✅ | ✅ | ✅ |
| Pro plan switch by key | ✅ | ✅ automated + browser | ✅ |
| Pro: resume parsing (TXT, PDF, DOCX) | ✅ | ✅ TXT/PDF automated; DOCX verified by hand once | ✅ |
| Pro: location-aware 8-criterion rubric | ✅ | ✅ automated (near beats far, same listing otherwise) | ✅ |
| Pro: RAG pipeline in MongoDB (listing + resume embeddings, retrieval, re-rank) | ✅ | ✅ automated + browser | ✅ (local embeddings) |
| Pro: assistant answers, extractive mode | ✅ | ✅ automated + browser | ✅ |
| Pro: assistant answers, **Gemini-generated** mode | ✅ code | ❌ never run | ⏸ needs `GEMINI_API_KEY` |
| Gemini embeddings provider | ✅ code | ❌ never run | ⏸ needs `GEMINI_API_KEY` |
| Live listings from 7 platforms, hourly refresh, expiry purge | ✅ | ✅ run live (366 listings) + unit tests | ✅ |
| Admin console (approvals, users, plans, listings, audit, notifier) | ✅ | ✅ API automated; approvals + stats checked in browser | ✅ |
| Account deletion / data erasure | ✅ | ✅ | ✅ |
| Security hardening (see `docs/SECURITY.md`) | ✅ | ✅ 17 controls covered by tests | ✅ |
| Billing / payments | ❌ not built (key-based activation instead) | — | — |
| Email verification for password sign-ups | ❌ not built | — | — |

**Currently running on this machine:** MongoDB (local), API on `http://localhost:5050`, web app on `http://localhost:5173` (Vite dev server). 366 open listings are loaded and embedded. The first admin was created from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in your `.env` (the password is only in that file).

## 2. Test results

`cd server && npm test` → **25 tests, 25 pass, 0 fail** (~40 s). `npm audit` on server and client: **0 vulnerabilities**. Client production build: passes.

**End-to-end (13)** — real Express app, real MongoDB in a throwaway database `hackelite_e2e_test` (dropped afterwards), real HTTP calls:
1. Security headers, no `x-powered-by`, CORS allowlist, 413 on oversized body, malformed JSON → 400, no stack traces
2. Password policy: each rule, `Password123!` rejected, name/email in password rejected
3. Register, duplicate email, bcrypt-12 hash stored, login, identical error for unknown vs wrong password
4. Lockout after 5 failures (correct password refused while locked)
5. NoSQL injection (`{$gt:''}`) and `__proto__` payloads neutralised
6. Privilege escalation: `role:'admin'`, `plan:'pro'`, `lister.approvalStatus` via sign-up/profile all ignored; admin routes → 403
7. Google flow with a mocked verifier: 501 when unconfigured, bad token 401, create, repeat sign-in, link to existing email, Google-only account sets password, lister-via-Google needs organisation
8. Password change and "sign out everywhere" revoke tokens; forgot/reset flow, single-use token
9. Lister journey: sign-up pending → blocked → admin sees request → approve → invalid template rejected with per-field errors → publish → public → notification delivered to the matching student only, no duplicates on rerun → ownership enforced → unpublish hides it → rejected lister blocked → admin disables user (session killed) → cannot self-disable/demote → audit log has the events
10. Free vs Pro: gated endpoints return 402; wrong key 403; correct key unlocks; fake PDF rejected by magic bytes; resume parsed; chunks and listing vectors stored in MongoDB but never returned by the API; Pune listing outranks identical Guwahati listing for a Pune student; assistant returns cited answer; prompt-injection text inside a listing is not obeyed; downgrade re-locks
11. Public listings API, `.ics` feed with day-before alarm, tracker
12. Account deletion erases data, needs password, last admin protected
13. Rate limiting returns 429 under credential stuffing

**Unit (12)**: skill matching, resume parsing (text + a real generated PDF + error cases), recommender ranking and filtering, ask parser and in-memory filters, ingest helpers, adapter registry.

**Browser (Chrome, by hand through the UI):** register page with live strength meter → sign-up lands on For you (Free) → Plan page → activate Pro with the key → assistant answer with citations; admin sign-in → pending lister → Approve → lister sees dashboard, notification badge and the event template.

**Not covered by any test:** real Google, real Gemini, real SMTP, a multi-instance deployment, load/performance beyond a few hundred listings, accessibility audit, cross-browser (only Chrome), mobile layouts beyond CSS review.

## 3. What needs external setup

None of these block running the app; each switches on an extra capability. Put values in the root `.env` (and `client/.env` where noted), restart the API.

| Capability | What you need | Where to get it | How to finish testing |
|---|---|---|---|
| **Google sign-in** | An OAuth 2.0 **Web client ID**. Add `http://localhost:5173` under *Authorised JavaScript origins* | [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → Create credentials → OAuth client ID → *Web application* (configure the consent screen first) | Set `GOOGLE_CLIENT_ID=` in `.env` **and** `VITE_GOOGLE_CLIENT_ID=` in `client/.env`; restart both; the grey "not configured" button becomes the real Google button. Sign in with a Google account → new user created; sign in again → same user; register a password account with the same email first → they link |
| **Gemini answers + embeddings** | API key | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (free tier available) | `GEMINI_API_KEY=...`; optional `EMBEDDINGS_PROVIDER=gemini` (listings re-embed automatically on the next ingest) and `GEMINI_MODEL`. In Assistant, the footer changes from "Built from your top retrieved matches" to "Generated by Gemini…". Check that answers cite `[1]…` that match the listed sources. **The Gemini calls were written against the public REST docs and have never been executed — expect to adjust model names if Google has changed them** |
| **Email** (reset links, digests) | An SMTP account | Gmail: enable 2-step verification, create an *App password*, use `smtps://you%40gmail.com:APP_PASSWORD@smtp.gmail.com:465`. Or Mailtrap / SES / Resend SMTP | Set `SMTP_URL`, `MAIL_FROM`, `APP_URL`. Use *Forgot password* with a real address; tick *email digest* in Profile and run *Run notifier* in Admin |
| **HTTPS / hosting** | A host (Render, Railway, Fly, a VPS) and TLS | Platform-provided certificates or Let's Encrypt | Set `NODE_ENV=production`, `CLIENT_ORIGIN=https://your-site`, strong `JWT_SECRET`, `PRO_ACTIVATION_KEYS`; set `trust proxy` hop count in `middleware/security.js`; build the client (`npm run build`) and serve `client/dist` |
| **MongoDB in production** | A managed cluster | [MongoDB Atlas](https://www.mongodb.com/atlas) free tier | Put its URI in `MONGO_URI`; optionally create an Atlas Vector Search index on `listings.embedding` (384 dims for local embeddings, 768 for Gemini) when listings exceed a few thousand |
| **Payments for Pro** | A payment provider | Razorpay / Stripe | Replace the key check in `server/routes/plan.js` with a verified webhook that sets `plan.tier` |

## 4. Known limitations (read before relying on it)

- Third-party listing endpoints are **unofficial**; any can change. A failing source appears as `failed: …` in the server log and the rest keep working.
- MLH, ETHGlobal, Hack Club, DoraHacks, Kaggle, Internshala and AtCoder are **not** included (no stable public JSON found).
- The local embedding model is a hashed bag-of-words with skill canonicalisation: good for topical matching, weaker than a neural model on paraphrase. Switch to Gemini embeddings for better semantics.
- Skill extraction is dictionary-based (≈ 50 skills in `server/services/skills.js`); users can edit the list.
- No email verification, CAPTCHA, or breached-password check. JWT is stored in `localStorage`. Details and mitigations in `docs/SECURITY.md`.
- Ingestion, indexing and notification jobs run inside the API process; run **one** API instance, or move jobs to a worker (see `docs/ARCHITECTURE.md` §7).
- Existing accounts from the previous project keep working: old `student` roles are migrated to `user` on startup. Their old 6-character passwords still log in, but any password *change* must meet the new policy.
- Your `JWT_SECRET` was rotated in this work (the previous value was the public default from the old source), so any pre-existing sessions were signed out.

## 5. Re-running the checks yourself
```bash
cd server && npm test                       # 25 tests, isolated DB, ~40 s
cd client && npm run build                  # production build
cd server && npm audit --omit=dev           # dependency vulnerabilities
```

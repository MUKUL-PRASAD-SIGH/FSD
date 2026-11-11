# API reference

Base URL: `http://localhost:5050` in development (the Vite dev server proxies `/api` and `/socket.io` to it). All bodies are JSON unless noted. Errors are always `{ "error": "message" }` (plus `"code"` for machine-readable cases such as `PRO_REQUIRED`), never a stack trace.

105 HTTP routes. The route list below is generated from the code, so it cannot drift: the **Access** column shows exactly which middleware guards each route.

## Conventions
| | |
|---|---|
| **Auth** | `Authorization: Bearer <JWT>` (HS256). Tokens carry the user's `tokenVersion`, so password changes, "sign out everywhere" and admin disabling revoke them instantly. |
| **Access** | `public` · `optional sign-in` · `signed in` · `Pro` (HTTP 402 `PRO_REQUIRED` otherwise) · `role admin/lister` (403) · `approved lister` (403 `LISTER_NOT_APPROVED`) |
| **Status codes** | `200/201` ok · `400` validation (may include `fields` or `problems`) · `401` not signed in · `402` needs Pro · `403` not allowed · `404` not found **or not yours** (deliberately identical) · `409` conflict · `410` event closed · `413` body too large · `423` account temporarily locked · `429` rate limited |
| **Request id** | every response has `X-Request-Id`; quote it in bug reports, it is in the server log line |
| **Caching** | personalised routes (`/me`, `/auth`, `/network`, `/teams`, `/chat`, `/calendar` settings, …) send `Cache-Control: private, no-store` |
| **Rate limits** | global 300/min per IP; sign-in family 30 per 15 min; heavy features (uploads, AI, crawling) 20/min; chat REST 120/min; calendar feed 3000/min |
| **IDs** | MongoDB ObjectIds as 24-hex strings. A malformed id answers `404`, not `500`. |

## Authentication (`/api/auth`)
| Method | Path | Access | What it does |
|---|---|---|---|
| GET | `/api/auth/config` | public | Public client config: Google client id, password minimum, whether email is enabled |
| POST | `/api/auth/password-check` | strict limit | Live password-strength feedback `{ ok, score, problems[] }` for the sign-up form |
| POST | `/api/auth/register` | strict limit | `{ name, email, password, accountType?: 'user'\|'lister', organisation?, website?, reason? }` → `201 { token, user }`. Rejects weak/breached passwords (400 with `problems`), duplicates (409). Sends a verification email |
| POST | `/api/auth/login` | strict limit | `{ email, password }` → `{ token, user }`. Same 401 for unknown email and wrong password; locks the account for 15 min after 5 failures (423) |
| POST | `/api/auth/google` | strict limit | `{ credential }` Google ID token, verified server-side (signature, expiry, audience) |
| GET | `/api/auth/me` | signed in | The current user (never includes password, tokens, resume text or embeddings) |
| POST | `/api/auth/change-password` | signed in, strict | `{ current, password }`. Revokes all other sessions |
| DELETE | `/api/auth/me` | signed in, strict | Right to erasure. `{ password }` re-authentication; removes the account, resume, tracker, notifications, questions and the whole social footprint. The last admin cannot be deleted |
| POST | `/api/auth/logout-all` | signed in | Bumps `tokenVersion`: every session, and every live socket, ends |
| POST | `/api/auth/forgot` | strict limit | `{ email }`. Identical answer whether or not the address exists. Email contains a single-use 30-minute link |
| POST | `/api/auth/reset` | strict limit | `{ token, password }` → signs the user in |
| POST | `/api/auth/verify/send` | signed in, strict | Sends a new verification email |
| POST | `/api/auth/verify` | strict limit | `{ token }` single-use, 24 h |

## Listings (`/api/listings`)
| Method | Path | Access | What it does |
|---|---|---|---|
| GET | `/api/listings` | public | Browse open events. Query: `q`, `type`, `mode`, `platform`, `city`, `free=true`, `closing=week`, `minPrize`, `sort=deadline\|prize\|popular`, `limit` (≤200), `offset` → `{ total, count, listings[] }` |
| GET | `/api/listings/stats` | public | `{ open, closingWeek, prizeInr, platforms[], types[], refreshedAt }` |
| GET | `/api/listings/calendar.ics` | public | Generic deadlines calendar (RFC 5545). `?ids=a,b` limits to chosen events |
| GET | `/api/listings/:id` | optional sign-in | One listing; adds `saved` when signed in. Unpublished listings are visible only to their lister and admins |

## Ask and assistant
| Method | Path | Access | What it does |
|---|---|---|---|
| POST | `/api/ask` | optional sign-in | `{ question }` plain English → `{ understood[], results[], total, note? }`. Reads type, mode, fee, deadline window, prize and **place**; a named place is a hard filter. Signed-in users are also ranked against their profile |
| POST | `/api/assistant/chat` | Pro, heavy | `{ question, history? }` RAG answer with `citations[]`. Gemini if configured, otherwise extractive |
| POST | `/api/assistant/reindex` | Pro, heavy | Re-embed listings |

## Per-hackathon agent (`/api/listings/:id/…`)
| Method | Path | Access | What it does |
|---|---|---|---|
| POST | `/api/listings/:id/ask` | signed in, heavy | `{ question, history? }` Crawls the event's own site (robots-aware, SSRF-safe, cached) and answers only from it → `{ answer, mode, sources[], page{ok,pagesRead,faqFound,jsOnly}, note, sharedAnonymously }` |
| GET | `/api/listings/:id/ask/history` | signed in | Your own past questions about this event (private) |
| DELETE | `/api/listings/:id/ask/history` | signed in | Clear them |
| GET | `/api/listings/:id/questions` | signed in | Anonymous "most asked" for the event (only questions asked 2+ times) |

## Me: profile, resume, recommendations, tracker, notifications (`/api/me`)
| Method | Path | Access | What it does |
|---|---|---|---|
| PUT | `/api/me/profile` | signed in | Partial update: `name, college, bio, githubUrl, linkedinUrl, skills[], interests[], location{city,state,country}, education{level,gradYear}, preferences{…}, privacy{shareQuestions}, social{discoverable,lookingForTeam,headline}, notify{inApp,email,minMatch,emailReminders,emailSocial}`. `role`, `plan`, `tokenVersion` are never assignable |
| POST | `/api/me/resume` | Pro, heavy | `multipart/form-data` field `resume` (PDF, DOCX, TXT; ≤5 MB; magic-byte checked; parsed in memory, never stored). → `{ user, parsed{ skillDetail, wordCount } }` |
| DELETE | `/api/me/resume` | signed in | Delete all resume-derived data |
| GET | `/api/me/recommendations` | signed in | `?limit` (≤50). Free: basic picks. Pro: 8-criterion rubric with `criteria[]`, `reasons[]`, `excluded{ineligible,duplicate,saved}` |
| GET | `/api/me/saved` | signed in | Your tracker |
| PUT | `/api/me/saved/:listingId` | signed in | `{ status?: saved\|applied\|shortlisted\|rejected\|won, note? }` upsert |
| POST | `/api/me/saved/:listingId/registered` | signed in | "I clicked Register": tracks as *applied*; never downgrades a later stage |
| DELETE | `/api/me/saved/:listingId` | signed in | Remove from the tracker |
| GET | `/api/me/notifications` | signed in | `{ unread, notifications[] }` |
| POST | `/api/me/notifications/read-all` · `/:id/read` | signed in | Mark read |

## Plans (`/api/plan`)
| Method | Path | Access | What it does |
|---|---|---|---|
| GET | `/api/plan` | signed in | Your tier and the Free/Pro feature lists |
| POST | `/api/plan/activate` | strict | `{ key }` constant-time compared with `PRO_ACTIVATION_KEYS` (replace with a payment webhook when billing exists) |
| POST | `/api/plan/downgrade` | signed in | Back to Free |

## Calendar (`/api/calendar`)
| Method | Path | Access | What it does |
|---|---|---|---|
| GET | `/api/calendar/feed/:token.ics` | public (secret token) | Your live personal feed: tracker (+ opt-in picks) with your reminders. No login, the 192-bit token in the URL is the credential |
| GET | `/api/calendar/links/:id` | public | Google / Outlook.com / Microsoft 365 add-event URLs for the deadline and, if known, the event dates |
| GET | `/api/calendar/settings` | signed in | `{ enabled, feedUrl, webcalUrl, reachableByGoogle, reminders[], includePicks, counts }` |
| PUT | `/api/calendar/settings` | signed in | `{ reminders?: [15\|60\|180\|1440\|4320\|10080 …max 3], includePicks? }` |
| POST | `/api/calendar/token` | signed in | Create **or rotate** the feed token (the old URL stops working at once) |
| DELETE | `/api/calendar/token` | signed in | Revoke the feed |
| GET | `/api/calendar/event/:id.ics` | signed in | One event as a file with *your* reminders and status |

## Network (`/api/network`) *(Pro endpoints marked)*
| Method | Path | Access | What it does |
|---|---|---|---|
| GET | `/api/network/overview` | signed in | `{ connections[], incoming[], outgoing[], invites{incoming[],outgoing[]} }` in one call |
| GET | `/api/network/people?q=` | signed in | Name search among people who opted in to discovery. **Pro:** plain-English skill search; `smart: true` |
| POST | `/api/network/requests` | signed in | `{ userId }` or `{ email }`. By email the answer never reveals whether an account exists. Auto-accepts if they already asked you. 50/day cap |
| POST | `/api/network/requests/:id/accept` · `/decline` | signed in | Recipient only |
| DELETE | `/api/network/requests/:id` | signed in | Cancel your outgoing request |
| DELETE | `/api/network/connections/:userId` | signed in | Remove a connection |
| GET / POST / DELETE | `/api/network/blocked`, `/block`, `/block/:userId` | signed in | Block list; blocking removes the connection and stops requests, DMs, invites and recommendations both ways |
| POST | `/api/network/invites/:id/accept` · `/decline` | signed in | Answer a team invite, room invite or (for owners) a join request |
| DELETE | `/api/network/invites/:id` | signed in | Cancel an invitation you sent |
| GET | `/api/network/recommendations/teammates` | **Pro** | Complementary-skills teammates (opt-in people only, never email) |
| GET | `/api/network/recommendations/teams` | **Pro** | Public teams with open slots that fit you |

## Teams (`/api/teams`)
| Method | Path | Access | What it does |
|---|---|---|---|
| GET | `/api/teams` | signed in | Teams you belong to |
| POST | `/api/teams` | **Pro host** | `{ name, listingId?, maxMembers?(2-10), visibility?, lookingFor[], description }` creates the team **and its private room** |
| POST | `/api/teams/share` | **Pro host** | Tracker "Team up": `{ listingId, userId\|email, teamId?, message? }` finds or creates your team for that hackathon, then invites |
| GET / PUT / DELETE | `/api/teams/:id` | member / owner / owner | View, edit (owner), disband (owner; deletes room and messages). Non-members get 404 |
| POST | `/api/teams/:id/invite` | **Pro host** (owner) | `{ userId\|email, message? }` generic response for emails |
| POST | `/api/teams/:id/leave` | member | Owners cannot leave: transfer or disband |
| DELETE | `/api/teams/:id/members/:userId` | owner | Remove a member (never the owner) |
| POST | `/api/teams/:id/transfer` | owner | `{ userId }` hand over ownership |
| POST | `/api/teams/:id/request` | **Pro** | `{ message? }` ask to join a *public* team |
| GET / POST | `/api/teams/:id/ideas` | **Pro** member | Idea board (≤5 ideas per member) |
| POST | `/api/teams/:id/ideas/:ideaId/vote` | **Pro** member | `{ rank: 1\|2 }` 10 / 5 points; cannot vote for your own idea; moving a vote replaces the old one |
| DELETE | `/api/teams/:id/ideas/:ideaId` | **Pro** author/owner | Delete an idea |

> **Host vs join.** Creating a team or room, inviting, and sharing are Pro. **Accepting an invitation and chatting is free.** See [SOCIAL.md](SOCIAL.md).

## Chat (`/api/chat`) and realtime
| Method | Path | Access | What it does |
|---|---|---|---|
| GET | `/api/chat/rooms` | signed in | Your rooms, newest first, with names, unread counts and last message; `unread` total |
| POST | `/api/chat/rooms/dm` | signed in | `{ userId }` open (or reuse) a DM; requires an accepted connection |
| POST | `/api/chat/rooms` | **Pro** | `{ name, invite?: [userId…] }` invite-only private room |
| GET | `/api/chat/rooms/:id` | member | Members and metadata |
| GET | `/api/chat/rooms/:id/messages` | member | `?before=<ISO>&limit≤100` newest page, oldest first |
| POST | `/api/chat/rooms/:id/messages` | member, msg limit | `{ text }` ≤2000 chars; REST fallback for the socket |
| POST | `/api/chat/rooms/:id/read` | member | Mark read |
| POST | `/api/chat/rooms/:id/invite` | **Pro** owner | `{ userId }` (must be your connection) |
| POST | `/api/chat/rooms/:id/leave` | member | Group rooms only |
| DELETE | `/api/chat/rooms/:id` | owner | Delete a private group room and its messages |

**WebSocket (Socket.IO, same port).** Connect with `io({ auth: { token: <JWT> }, transports: ['websocket'] })`.
- Client → server: `message:send` `{roomId,text}` (ack `{ok,message|error}`) · `typing` `{roomId,on}` · `room:read` `{roomId}` (ack)
- Server → client: `ready` · `message:new` · `typing` · `notification:new` · `room:added` · `room:removed`
- The server decides which rooms a socket joins (from the database). Limit: 20 messages/10 s per socket, 16 KB payloads. Revoked sessions are disconnected immediately.

## Lister (organiser) (`/api/lister`)
| Method | Path | Access | What it does |
|---|---|---|---|
| GET | `/api/lister/template` | signed in | The allowed values for the event form (types, modes, eligibility) |
| POST | `/api/lister/apply` | role user | Ask to become a lister (stays `user` until an admin approves) |
| GET | `/api/lister/listings` | lister/admin | Your events |
| POST / PUT / DELETE | `/api/lister/listings[/:id]` | approved lister | Publish / edit / remove your event. Field errors come back as `{ fields: { title: "…" } }` |
| GET | `/api/lister/listings/:id/questions` | lister/admin (owner) | Anonymous, aggregated questions people asked about **your** event |

## Admin (`/api/admin`) — role `admin` only
| Method | Path | What it does |
|---|---|---|
| GET | `/api/admin/stats` | Users by role, pending listers, Pro users, listings by source, open count |
| GET | `/api/admin/listers` · POST `/listers/:id/decision` | Pending organisers; `{ decision: 'approve'\|'reject', note? }` (audited, notifies the user) |
| GET / PATCH | `/api/admin/users[/:id]` | Search users; change role, status (disable kicks the user out), plan |
| GET / PATCH | `/api/admin/listings[/:id]` | Moderate listings (unpublish / republish) |
| GET | `/api/admin/audit` | Append-only security log |
| GET | `/api/admin/sources` · `/sources/:source/history` | Ingestion coverage per source and sync history |
| POST | `/api/admin/ingest/run` | Run a full sync now (one at a time) |
| GET | `/api/admin/integrations` | Real request to every configured integration (Gemini, SMTP, Google, Kaggle, clist, MongoDB); secrets never included |
| POST | `/api/admin/notifier/run` | Run the notification generator now |

## Health
| Method | Path | What it does |
|---|---|---|
| GET | `/api/health` | Liveness: the process is up |
| GET | `/api/health/ready` | Readiness: `200 { db: "up" }` only when MongoDB is connected, otherwise `503`. Use this for load balancers; the Docker `HEALTHCHECK` does |

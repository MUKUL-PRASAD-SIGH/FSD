# Network, teams, chat and reminders

Teammate features inspired by the [Hackathon-Dashboard](https://github.com/MUKUL-PRASAD-SIGH/Hackathon-Dashboard) reference app, rebuilt on this platform's accounts, tracker and plan system with stricter security. Nothing from that repo is copied: its hard-coded fallback JWT secret, unsigned base64 socket tokens and `test-token` bypass are deliberately **not** carried over.

## Free vs Pro

| | **Free** | **Pro** |
|---|---|---|
| Connect with people: search by name (opt-in people), request by exact email, accept / decline / block | ✅ | ✅ |
| Direct messages with connections, live | ✅ | ✅ |
| **Join** a team or private room you were invited to, and chat in it | ✅ | ✅ |
| **Host** hackathon rooms: create a team with its private team room, invite by connection or email (accept → joins team + room + the hackathon lands in the invitee's tracker) | ❌ | ✅ |
| **Host** invite-only private group rooms | ❌ | ✅ |
| Tracker **Team up** (finds or creates your team for that hackathon, then invites) | ❌ | ✅ |
| **Register** click saves the hackathon to your tracker as *applied* | ✅ | ✅ |
| Live notifications (socket) + in-app list; email for requests/invites (verified, opt-out) | ✅ | ✅ |
| Email reminders before tracked deadlines (verified, opt-in, your chosen lead times) | ✅ | ✅ |
| Teammate recommendations (complementary skills, shared tracked hackathons, looking-for-team, wins) | ❌ | ✅ |
| Open-team recommendations + **ask to join** public teams | ❌ | ✅ |
| Plain-English people search ("react designers looking for a team") | ❌ | ✅ |
| Public teams (discoverable, open to requests) | ❌ | ✅ |
| Team idea board with ranked voting (1st = 10 pts, 2nd = 5 pts) | ❌ | ✅ |

**Rule of thumb:** Pro members *host* (create and run hackathon rooms); anyone invited can *join and chat* for free. The check lives in the services (`social.proOnly` in `createTeam`, `inviteToTeam`, `inviteToRoom`, `shareListing`, `createGroup`), so no route can bypass it; the UI shows upsells at the same points. A user who owned a team before downgrading keeps it, its room and its history, but cannot invite more people.

## Privacy model
- **Opt-in discovery.** Nobody appears in people search or recommendations until they switch on *Let teammates find me* (`social.discoverable`, default off). Only name, headline and skills are ever shown. **Email is never returned by any social endpoint.**
- **By email, no enumeration.** Connection requests and team invites by email return the same response whether or not the address has an account; nothing is sent to unregistered addresses.
- **Membership is the only chat access rule.** Non-members get the same 404 for "not yours" and "does not exist". Sockets are joined to rooms by the server from the database, never by client request.
- **Email only to verified addresses**, per-user opt-outs, and every social email is rate limited by the daily request/invite caps (50 each).
- **Blocking** removes the connection and stops requests, DMs, invites and recommendations in both directions.
- **Account deletion** erases connections, invites, DMs, the user's messages in shared rooms and idea votes, and hands teams/rooms to a remaining member (or deletes them when empty).
- Message text is stored as plain text (max 2000 chars) and rendered as text, never HTML.

## Realtime (Socket.IO on the API port)
Handshake `auth.token` = the same JWT as REST (HS256, active user, current `tokenVersion`). Events:
`message:send` (ack) · `typing` · `room:read` (client→server); `message:new` · `typing` · `notification:new` · `room:added` · `room:removed` · `ready` (server→client). Per-socket limit 20 messages/10 s, 16 KB payload cap, sockets drop immediately when a session is revoked. REST (`POST /api/chat/rooms/:id/messages`) is a full fallback.

**Scaling:** one Node process today. To run several instances put `@socket.io/redis-adapter` behind the same API (rooms already use stable names `user:<id>` / `room:<id>`), and move the reminder scheduler to a single worker.

## API summary (all require sign-in, all `no-store`)
- `GET /api/network/overview` · `GET /api/network/people?q=` · `POST /api/network/requests` · `POST /api/network/requests/:id/accept|decline` · `DELETE /api/network/requests/:id` · `DELETE /api/network/connections/:userId` · `POST|DELETE /api/network/block` · `POST /api/network/invites/:id/accept|decline` · `DELETE /api/network/invites/:id`
- Pro: `GET /api/network/recommendations/teammates|teams`
- `GET|POST /api/teams` · `POST /api/teams/share` · `GET|PUT|DELETE /api/teams/:id` · `POST /api/teams/:id/invite|leave|transfer` · `DELETE /api/teams/:id/members/:userId` · Pro: `POST /api/teams/:id/request`, `GET|POST /api/teams/:id/ideas`, `POST /api/teams/:id/ideas/:ideaId/vote`
- `GET /api/chat/rooms` · `POST /api/chat/rooms[/dm]` · `GET /api/chat/rooms/:id[/messages]` · `POST /api/chat/rooms/:id/messages|read|invite|leave` · `DELETE /api/chat/rooms/:id`
- `POST /api/me/saved/:listingId/registered`
- Profile fields: `social.{discoverable,lookingForTeam,headline}`, `notify.{emailReminders,emailSocial}`

## Reminder emails
`services/reminders.js` runs every 15 minutes (single instance). For each opted-in, verified user it checks tracked hackathons (saved / applied / shortlisted) against the user's calendar lead times (15 min … 1 week; default 1 day) and sends one email per lead time, recorded in `ReminderLog` (unique per user, listing, lead time) so restarts never double-send. A reminder is only sent within 3 hours after its scheduled moment and never after the deadline, so tracking an event late does not fire a stale "7 days to go".

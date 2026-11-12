# Deployment guide

HackElite is one Node process (API + Socket.IO + optional static client) and one MongoDB. This page covers local production-like runs, Docker, a real server, and what to check before you go live.

## 1. Pick a mode

| Mode | When | Command |
|---|---|---|
| **Development** | coding | `npm run dev` (MongoDB + API `:5050` + web `:5173`, hot reload) |
| **Docker Compose** | the easiest production-like run, one machine | `npm run docker:up` → http://localhost:5050 |
| **Single process, your own MongoDB** | a VM, a PaaS, a small server | `npm run build`, then run `server/server.js` with `SERVE_CLIENT=true` |
| **Split** | static host for the client, separate API host | build `client/`, host `client/dist`, point it at the API (reverse proxy `/api` and `/socket.io`) |

## 2. Docker

`Dockerfile` is multi-stage: it compiles the React app, then builds a small `node:22-alpine` image that runs as the non-root `node` user, serves API + built client on `:5050`, and has a `HEALTHCHECK` on `/api/health/ready`.

```bash
cp .env.example .env     # fill the required values (section 4)
npm run docker:up        # builds, starts MongoDB 7 (volume mongo-data) and the app, waits for Mongo to be healthy
```

`docker-compose.yml` overrides `MONGO_URI` to the compose database, sets `NODE_ENV=production` and `CLIENT_ORIGIN` from `APP_URL`. Data survives restarts in the `mongo-data` volume. Back it up with `mongodump`.

## 3. Shared setup: MongoDB Atlas and Render

The repository includes [`render.yaml`](../render.yaml), a Render Blueprint for one Docker web service that serves both the React client and API. It uses Render's free plan and Singapore region as a no-cost starting point. The app automatically uses Render's assigned `PORT` and public URL, and the Blueprint prompts you for `MONGO_URI`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`; Render generates `JWT_SECRET` and `PRO_ACTIVATION_KEYS`. It does not create an Atlas database or store credentials in Git.

This free setup is for demos and small hobby use. Render free services can sleep after 15 minutes without traffic and take about a minute to wake, and MongoDB Atlas Free has limited resources. For production with predictable response times, choose paid plans only after reviewing their current costs. [Render free service limits](https://render.com/docs/free) · [Atlas Free cluster limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/).

### 1. Create the shared MongoDB database

1. Sign in to [MongoDB Atlas](https://cloud.mongodb.com), create a project, then create an **M0 Free** cluster. Choose an available region close to the Render Singapore region if Atlas offers one for your account. Atlas does not let you move an existing cluster to a different region; see [Atlas Free cluster setup](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/).
2. In **Database Access**, create a database user with read/write access to `hackelite_db`. Use a strong, unique password.
3. In **Network Access**, leave the list restricted. After the Render service is created, copy its outbound CIDR ranges from **Render service → Connect → Outbound**, then add those ranges to the Atlas project's IP access list. Atlas accepts individual IPs or CIDR ranges; see [Atlas IP access lists](https://www.mongodb.com/docs/atlas/security/ip-access-list/) and [Render outbound IPs](https://render.com/docs/outbound-ip-addresses). Render's default ranges are shared by services in the same region, so keep a strong database password and do not add `0.0.0.0/0`.
4. From Atlas **Connect → Drivers**, copy the Node.js connection string. Replace the username/password placeholders, include `/hackelite_db` as the database, and keep the finished URI private. URL-encode reserved characters in the database password.

### 2. Create the Render service

1. Commit and push the reviewed project changes, including `render.yaml`, to the GitHub repository.
2. Sign in to [Render](https://dashboard.render.com), choose **New → Blueprint**, connect the GitHub repository, and select its branch. Render reads `render.yaml` and asks for `MONGO_URI`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`; enter them in the dashboard. Do not add the secrets to the repository. Use an admin password that meets the project's password policy.
3. The first deploy may not pass its database readiness check until Atlas allows the Render outbound CIDRs. Once the service page exists, copy all ranges from **Connect → Outbound**, add them in Atlas **Network Access**, then use Render **Manual Deploy → Deploy latest commit**.
4. When Render reports the service healthy, open its `onrender.com` URL. Check `https://<your-service>.onrender.com/api/health/ready`; it should return `{"ok":true,"db":"up",...}`. Everyone should use that same public app URL. The client and API share one origin, so `VITE_API_ORIGIN` stays unset.

Render supplies `RENDER_EXTERNAL_URL`; the server uses it as the default browser origin and app URL when no custom domain is configured. If you later add a custom domain, set `CLIENT_ORIGIN` and `APP_URL` to that HTTPS origin in the Render environment and redeploy. See [Render environment variables](https://render.com/docs/environment-variables) and [Blueprint configuration](https://render.com/docs/blueprint-spec).

Existing data in this computer's local MongoDB is not copied into Atlas by deployment. Migrating it would transfer user profiles, resume data, and chat history; decide which data to preserve and authorize that transfer separately before importing it.

## 4. Without Docker

```bash
npm run setup && npm run build
# .env: NODE_ENV=production SERVE_CLIENT=true MONGO_URI=... (see section 4)
node server/server.js            # or a process manager: pm2 start server/server.js --name hackelite
```

`SERVE_CLIENT=true` makes the API serve `client/dist` with a locked-down Content-Security-Policy (hash-based inline script allowance, Google sign-in domains only). Use **one instance** (see section 7).

For users on different computers, all users need the same public app URL, API process, and persistent MongoDB. The local quick start intentionally uses each machine's own MongoDB and cannot sync users or requests between machines. Production startup now fails if `MONGO_URI` is missing.

## 5. Environment

Copy `.env.example` to `.env` (git-ignored). Where to get each external key, step by step, is in [ENV_SETUP.md](ENV_SETUP.md); check them with real requests using `npm run integrations:check` (or Admin → Integrations).

**Required in production** (the server refuses to start otherwise):

| Variable | Rule |
|---|---|
| `NODE_ENV` | `production` |
| `MONGO_URI` | your MongoDB (Atlas recommended: `mongodb+srv://…`) |
| `JWT_SECRET` | ≥ 32 random characters. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `PRO_ACTIVATION_KEYS` | at least one key; **change the public demo key** |
| `CLIENT_ORIGIN` | exact browser origin(s), comma separated, never `*` |
| `APP_URL` | the public site URL (used in emails and calendar links) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | first admin, created on start; password must satisfy the policy |

**Strongly recommended:** `SMTP_URL` + `MAIL_FROM` (verification, reset, reminders, invites), `GOOGLE_CLIENT_ID` (Google sign-in; add your site under *Authorised JavaScript origins*), `GEMINI_API_KEY` (fluent assistant/agent answers and better embeddings).

**Optional:** `KAGGLE_*`, `CLIST_*` (two more sources), `INGEST_INTERVAL_MIN`, `ENABLED_SOURCES`, `DISABLE_INGEST` (for read-only replicas).

For a separately hosted client, set `VITE_API_ORIGIN` to the shared API's origin at client build time (for example `https://api.example.com`) and set that API's `CLIENT_ORIGIN` to the client's exact origin. Leave `VITE_API_ORIGIN` empty when `SERVE_CLIENT=true` serves both from one origin.

## 6. Reverse proxy and HTTPS

The app does not terminate TLS. Put it behind nginx, Caddy, a cloud load balancer or your PaaS, and:
1. **Force HTTPS.** HSTS is sent automatically in production.
2. **Forward WebSockets** (`/socket.io`). Without the upgrade headers chat falls back to REST sending and live updates stop.
3. **Pass the real client IP**. `trust proxy` is set to `1` hop in production; change it in `server/middleware/security.js` if you have more hops, otherwise rate limits see the proxy's IP.

nginx example:

```nginx
server {
  listen 443 ssl http2;
  server_name hackelite.example.com;
  # ssl_certificate ... (Let's Encrypt)

  client_max_body_size 6m;                     # resume uploads are limited to 5 MB

  location /socket.io/ {
    proxy_pass http://127.0.0.1:5050;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 120s;
  }
  location / {
    proxy_pass http://127.0.0.1:5050;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

**Calendar sync note:** Google and Outlook on the web fetch each user's calendar feed from *their* servers, so `APP_URL` must be a public HTTPS address. On `localhost` only desktop calendar apps on the same machine can subscribe (the UI says so).

## 7. Operations

| Need | How |
|---|---|
| Is it healthy? | `GET /api/health` (liveness) · `GET /api/health/ready` (503 until MongoDB is connected). Use readiness for load balancers |
| Logs | one JSON line per request in production (`id`, `method`, `path`, `status`, `ms`, `uid`). Ship to any log service. `X-Request-Id` in a bug report finds the line |
| Graceful stop | `SIGTERM`: stop accepting, drain requests, close sockets and MongoDB, exit (hard stop after 10 s) |
| Data refresh | ingestion runs on start (after 3 s) and every `INGEST_INTERVAL_MIN` (default 60). Run now: Admin → Sources, or `npm run ingest` |
| Source health | Admin → Sources (per-source counts, errors, history); `npm run sources:check` |
| Reminder emails | a scheduler checks every 15 min; idempotent (`ReminderLog`) |
| Backups | `mongodump --uri "$MONGO_URI"`; Atlas has snapshots. Resume text and chat history live in MongoDB: enable encryption at rest and restrict network access |
| Updating | `git pull`, `npm run verify`, rebuild image / restart. Indexes are created automatically on start; the `migrate()` step fixes legacy data |
| Smoke test a deployment | `npm run e2e` against a **staging** database (it uses its own throw-away database name) |

## 8. Scaling (honest limits)

| Concern | Today | To go beyond one instance |
|---|---|---|
| Background jobs (ingestion, notifier, reminders) | `setInterval` inside the API process | run **one** instance, or move jobs to a dedicated worker (BullMQ/SQS) with leader election |
| WebSockets | in-memory Socket.IO rooms | add `@socket.io/redis-adapter`; room names (`user:<id>`, `room:<id>`) are already stable |
| Rate limiting | in-memory per instance | a Redis store (`rate-limit-redis`) so limits are shared |
| Vector search | brute-force cosine in Node (fine for thousands of listings) | MongoDB Atlas Vector Search on `listings.embedding`, same schema |
| Sessions | stateless JWT + `tokenVersion` | refresh tokens + httpOnly cookies with CSRF protection |
| Mail | SMTP from the API | a transactional provider (Brevo/Resend/SES) on your own domain: same `SMTP_URL` |

## 9. Go-live checklist

- [ ] `npm run verify` is green on the commit you deploy
- [ ] `NODE_ENV=production`, strong `JWT_SECRET`, **changed** `PRO_ACTIVATION_KEYS`, real `ADMIN_*` password
- [ ] HTTPS, WebSocket upgrade, correct `CLIENT_ORIGIN` and `APP_URL`
- [ ] MongoDB is private (VPC / IP allow-list), backups scheduled
- [ ] SMTP verified with `npm run integrations:check smtp` (your own domain, SPF/DKIM set up)
- [ ] Google OAuth origin added, consent screen published
- [ ] `npm audit` clean (CI enforces high severity)
- [ ] Privacy policy mentions: crawling event pages, anonymous question counts (opt-out), Gemini data sharing if enabled, email reminders ([CRAWLER.md](CRAWLER.md))
- [ ] You chose a licence for the repository

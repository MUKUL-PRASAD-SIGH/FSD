# Environment setup guide

Every setting lives in **one** git-ignored file: `.env` in the repo root (copy `.env.example`). Restart the API after changing it. Never commit `.env`, paste keys into issues or chats, or put them in screenshots.

After each step, verify with **real requests**:
```bash
cd server && npm run integrations:check          # all configured integrations
cd server && npm run integrations:check gemini_generate smtp   # just some
```
Admins can run the same checks in the browser at **Admin → integrations**. "not configured" means the variable is blank. "failing" shows Google's/the server's actual error message.

---

## 1. Required

### MongoDB: `MONGO_URI`
- **Local:** install MongoDB Community, or run `bash scripts/setup-dev-tools.sh && source /opt/tools/env.sh && start_mongo`. Then use `MONGO_URI=mongodb://127.0.0.1:27017/hackelite_db`.
- **Atlas (production):** https://cloud.mongodb.com → create a free M0 cluster.
  1. **Database Access** → add a user with *Read and write to any database* and a long random password.
  2. **Network Access** → add your server's IP (avoid `0.0.0.0/0` in production).
  3. **Connect → Drivers** → copy `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/hackelite_db?retryWrites=true&w=majority`.
- Check: `npm run integrations:check mongodb` → `connected to hackelite_db`.

Each local `127.0.0.1` address refers to the computer running that process. It does not share data with another computer. For shared accounts, requests, and roles, configure the one public API deployment with the Atlas URI and make all browsers use that same app. `NODE_ENV=production` now requires `MONGO_URI` explicitly.

### Auth: `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # paste as JWT_SECRET
```
- `ADMIN_PASSWORD` must meet the policy: 10+ characters, upper and lower case, a digit, a symbol, not a common word, and not containing your email or name. If it fails, the server logs why and **does not** create the admin.
- Rotating `JWT_SECRET` signs everyone out (by design).
- Check: `npm run integrations:check jwt admin_bootstrap`.

### More admins: `ADMIN_EMAILS`
Comma-separated, e.g. `ADMIN_EMAILS=you@gmail.com,cofounder@gmail.com`. An account with one of these emails becomes an admin only when **every way into it is controlled by the inbox owner**, which stops account pre-hijacking (someone registering your address first with their own password):
- **Sign in with Google** (easiest): Google proves the inbox. If the account had a password that was never proven, it is removed and other sessions are ended, then you are admin.
- **Or "Forgot password"**: set your password through the emailed reset link, and you are admin right away.
- A password chosen at sign-up is **not** enough, even after clicking the verification link, because whoever typed the email chose it.

No password goes in `.env`. These addresses (plus every admin account) also receive admin alert emails: a user added a new college, someone reported a listing, and a once-a-day digest of confusing listings. Alerts need `SMTP_URL`.

### Plans: `PLANS_ENABLED`, `PRO_ACTIVATION_KEYS`
`PLANS_ENABLED=false` (the default) makes every feature free for every signed-in user and hides the Plan page and every Pro label. Set it to `true` to bring back the Free/Pro split; only then do the keys below matter.

Comma-separated keys, e.g. `PRO_ACTIVATION_KEYS=HE-PRO-7f3a9c2e,HE-PRO-1b8d44aa`. Generate with `node -e "console.log('HE-PRO-'+require('crypto').randomBytes(6).toString('hex'))"`. With plans on, the server refuses to start in production without keys or with the public demo key.

---

## 2. Google sign-in: `GOOGLE_CLIENT_ID`

Only the **server** variable is needed. The browser fetches the client ID from `/api/auth/config`; `VITE_GOOGLE_CLIENT_ID` is not used.

1. https://console.cloud.google.com → create or select a project.
2. **APIs & Services → OAuth consent screen** (Google Auth Platform → Branding/Audience):
   - User type **External**; app name "HackElite"; support email; developer contact.
   - Scopes: the defaults `openid`, `email`, `profile` are enough; no sensitive scopes.
   - While in **Testing**, add your Google accounts under **Test users**. Publish the app when going live.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**:
   - **Authorised JavaScript origins:** `http://localhost:5173` (dev), `http://localhost:5050` (if using `SERVE_CLIENT=true` locally), and your production origin, e.g. `https://hackelite.example.com`.
   - **Authorised redirect URIs:** none needed. The app uses Google Identity Services popup mode, and the server verifies the ID token.
4. Copy the client ID (`1234…-abc….apps.googleusercontent.com`) into `GOOGLE_CLIENT_ID=`. The client secret is **not** used; don't store it.
5. Restart the API. The grey "not configured" button becomes the real Google button.
6. Check: `npm run integrations:check google_oauth` (client ID format and Google's signing keys). Then **finish the test by hand**:
   - sign in with a test Google account → a new user is created;
   - sign out and sign in again → same user;
   - register a password account with another email, then use Google with that same email → the accounts link.

## 3. Gemini: `GEMINI_API_KEY` (optional `GEMINI_MODEL`, `EMBEDDINGS_PROVIDER`)

1. https://aistudio.google.com/apikey → **Create API key** (choose or create a Google Cloud project). The free tier is enough for development.
2. `GEMINI_API_KEY=...`; the default `GEMINI_MODEL=gemini-2.5-flash`.
3. Optional: `EMBEDDINGS_PROVIDER=gemini` switches semantic matching to `gemini-embedding-001` (768 dims). Listings re-embed automatically on the next ingest; resumes re-embed on the next upload.
4. Check: `npm run integrations:check gemini_generate gemini_embeddings` should report "answered pong" and "returned 768 dimensions". In the app, the Assistant footer changes from "Built from your top retrieved matches" to "Generated by Gemini".
- If Google retires a model, set `GEMINI_MODEL` / `GEMINI_EMBED_MODEL` to the current names from https://ai.google.dev/gemini-api/docs/models. No code change is needed.
- This sandbox confirmed that requests reach Google and are rejected only for an invalid key. **Generation has not been run with a real key.**

## 4. Email: `SMTP_URL`, `MAIL_FROM`, `APP_URL`

Gmail with an app password:
1. Google Account → Security → turn on **2-Step Verification**.
2. https://myaccount.google.com/apppasswords → create an app password named "HackElite" (16 characters).
3. `SMTP_URL=smtps://you%40gmail.com:APPPASSWORDNOSPACES@smtp.gmail.com:465`. URL-encode `@` in the username as `%40`.
4. `MAIL_FROM=HackElite <you@gmail.com>` (Gmail rewrites other From addresses); `APP_URL` is the public URL used in reset links.
5. Check: `SMTP_TEST_TO=you@gmail.com npm run integrations:check smtp` logs in and sends a test email. Then test **Forgot password** in the UI, and tick "email digest" in Profile → Admin → Run notifier.

Alternatives: Resend, Brevo, Mailgun or Amazon SES SMTP credentials work the same way (`smtps://user:pass@host:465`). For production deliverability, verify your sending domain (SPF/DKIM) with the provider.

## 4b. SMS and WhatsApp reminders: `TWILIO_*` (optional)
Signed-in users can verify a mobile number (one-time code via Twilio Verify) and get a text 1 day (and 3 hours, if they picked it) before deadlines in their tracker. Nothing is sent without these settings; the Profile section only appears once they are set.

1. **Account**: [console.twilio.com](https://console.twilio.com) → *Account info*: copy **Account SID** → `TWILIO_ACCOUNT_SID` and **Auth token** → `TWILIO_AUTH_TOKEN`. A trial account can only text numbers you verified in the console; upgrade before launch.
2. **Verify service** (phone codes): *Verify → Services → Create new*, name it HackElite, enable SMS (and WhatsApp if you want) → copy the **Service SID** (`VA…`) → `TWILIO_VERIFY_SERVICE_SID`.
3. **SMS sender**: *Messaging → Services → Create*, add a sender → **Messaging Service SID** (`MG…`) → `TWILIO_MESSAGING_SERVICE_SID` (or put a Twilio number in `TWILIO_SMS_FROM`).
   - **India**: SMS to Indian numbers needs **DLT registration** (your business as Principal Entity, a sender ID/header, and approved templates) with an operator portal such as Jio, Airtel or Vodafone Idea, then the DLT details added in Twilio. The reminder text is: `HackElite: "<event>" closes in <time>. <link> Reply STOP to stop reminders.` Register that template.
4. **WhatsApp** (often easier first): *Messaging → Try it out → WhatsApp* gives a sandbox number (`+14155238886`) to test with → `TWILIO_WHATSAPP_FROM`. For real users, register a WhatsApp sender, create a content template in *Messaging → Content Template Builder* with the body `HackElite: "{{1}}" closes in {{2}}. {{3}}`, get it approved, and put its SID (`HX…`) in `TWILIO_WHATSAPP_TEMPLATE_SID`. WhatsApp only allows free text within 24 hours of the user's last message; reminders outside that window must use the template.
5. **Replies (STOP/START)**: set the *incoming message* webhook of your Messaging Service / number / WhatsApp sender to `<APP_URL>/api/sms/inbound` (HTTP POST). The server checks Twilio's signature with your auth token, so `APP_URL` must be exactly the public URL Twilio calls.
6. Optional: `SMS_DEFAULT_COUNTRY_CODE` (default `+91`, used when someone types a 10-digit number) and `SMS_DAILY_CAP_PER_USER` (default 4).
7. Check with `npm run integrations:check twilio` (or Admin → Integrations).

## 5. Listing sources

Most sources need nothing. Two free keys add coverage:
- **Kaggle:** kaggle.com → Settings → **API → Create New Token**. This downloads `kaggle.json` with `username` and `key` → `KAGGLE_USERNAME`, `KAGGLE_KEY`.
- **clist.by:** create an account, then https://clist.by/api/v4/doc/ shows `ApiKey username:key` → `CLIST_USERNAME`, `CLIST_API_KEY`.

Check all sources live without touching the DB: `cd server && npm run sources:check`. In the app: **Admin → Sources → Sync all now**.

## 6. Production

```
NODE_ENV=production
CLIENT_ORIGIN=https://hackelite.example.com
APP_URL=https://hackelite.example.com
SERVE_CLIENT=true          # serve client/dist from the API (one process, one origin)
```
- `cd client && npm ci && npm run build`, then `cd server && npm ci --omit=dev && npm start` behind HTTPS (Render, Railway, Fly or a VPS with Caddy/nginx).
- `trust proxy` is set to 1 hop in production (`server/middleware/security.js`); change it if you have more proxies.
- Run **one** API instance: ingestion and notifier jobs run in-process (see docs/ARCHITECTURE.md §7).
- Add the production origin to the Google OAuth client's JavaScript origins.
- Keep the API and MongoDB shared by all users. For a separate static client, set `VITE_API_ORIGIN=https://api.example.com` at build time and set the API's `CLIENT_ORIGIN` to the static client's exact HTTPS origin. The browser and API must both use the same deployment/database.

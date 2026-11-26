# Postman collection

`HackElite.postman_collection.json` covers health, auth, listings, analytics intake, the admin analytics + AI endpoints, access control and the user-AI guardrail. Every request has test assertions (35 requests, 60 assertions).

## Import
1. In Postman: **Import** → pick both files in this folder.
2. Select the **HackElite local** environment and fill in:
   - `baseUrl`: `http://localhost:5050` (the API) or `http://<LAN-IP>:5173` (through the web dev server)
   - `userEmail` / `userPassword`: any account
   - `adminEmail` / `adminPassword`: an admin account
3. Leave `userToken`, `adminToken` and `listingId` empty; the requests fill them in.

## Run
- **Health only:** run folder **1. Health**. No credentials needed.
  - `GET /api/health` → `200 { ok: true, time, localDb }`: the process is up. `localDb: false` means a shared database such as Atlas.
  - `GET /api/health/ready` → `200 { db: "up" }`: MongoDB is connected (`503` when it is not).
- **Everything:** Collection Runner → run the whole collection in order (folder 2 stores the tokens later folders use).

From the command line, with [Newman](https://www.npmjs.com/package/newman):

Keep passwords out of the command line (it ends up in shell history and is visible to other processes). Copy the environment to a private file that git ignores, fill it in there, and point Newman at it:

```bash
cp docs/postman/HackElite.local.postman_environment.json docs/postman/private.postman_environment.json   # git-ignored
# edit private.postman_environment.json: baseUrl, userEmail, userPassword, adminEmail, adminPassword
npx newman run docs/postman/HackElite.postman_collection.json -e docs/postman/private.postman_environment.json
```

Use test accounts, not your real admin account, when pointing it at a shared database.

## Notes
- Folders 4 and 5 write a few analytics events (a page view, a listing view, a search for "postman test", 30 s of time) and two admin AI questions to the audit log. Point it at a test database if that matters.
- The Pro assistant check in folder 7 accepts either a refusal (Pro account) or `402/403` (free account).
- Never save real passwords in the environment file you commit; the committed one has them blank.

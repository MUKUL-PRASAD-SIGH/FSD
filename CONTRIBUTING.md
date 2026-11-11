# Contributing to HackElite

Thanks for helping. This guide gets you from clone to a merged change.

## 1. Set up (5 minutes)

```bash
git clone https://github.com/MUKUL-PRASAD-SIGH/FSD.git && cd FSD
nvm use                 # Node 22 (see .nvmrc); Node 20+ works
npm install             # root tooling (concurrently, wait-on)
npm run setup           # server + client dependencies
cp .env.example .env    # then set JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD (see docs/ENV_SETUP.md)
npm run dev             # MongoDB (zero-install) + API :5050 + web :5173
```

No MongoDB installed? `npm run dev` starts a real, persistent one for you (`server/scripts/dev-db.js`). Using Atlas or your own? Set `MONGO_URI` and run `npm run dev:nodb`.

## 2. The checks every change must pass

```bash
npm run verify          # server tests + client build + live end-to-end run
```

| Command | What it proves |
|---|---|
| `npm test` | 100+ unit, integration and in-process journey tests (real MongoDB, real WebSockets) |
| `npm run build` | the React app compiles for production |
| `npm run e2e` | the **real server process** survives the full product journey (41 checks) |

Tip: `npm run e2e` accepts `E2E_PHASES=4,7` (run only some phases), `E2E_SKIP="text"` (skip steps) and `E2E_VERBOSE=1` (print the whole server log on failure). See [docs/TESTING.md](docs/TESTING.md).

## 3. How to make a change

1. **Branch** from `main`: `feat/short-name`, `fix/short-name`, `docs/short-name`.
2. **Write the test first or with the change.** Bug fixes need a regression test. A new endpoint needs tests for success, validation, authorisation (401/403/404) and, for personal data, isolation between two users.
3. **Keep it small and explain why.** Prefer several focused commits over one big one.
4. **Update the docs** that your change touches (see the table below).
5. **Open a pull request** using the template. CI must be green.

### Commit messages
[Conventional Commits](https://www.conventionalcommits.org/): `feat(scope): …`, `fix(scope): …`, `test(scope): …`, `docs: …`, `build: …`, `chore: …`. The body says *why*, not what.

## 4. Where things live

See [docs/CODEBASE_GUIDE.md](docs/CODEBASE_GUIDE.md) for a tour with file paths. In short: `server/routes` (HTTP), `server/services` (logic), `server/models` (MongoDB), `client/src/pages` (screens).

| If you change… | …also update |
|---|---|
| an endpoint | `docs/API.md` |
| anything security related | `docs/SECURITY.md` and its tests |
| the social features (chat, teams, network) | `docs/SOCIAL.md` |
| the crawler / agent | `docs/CRAWLER.md` |
| env variables | `.env.example`, `docs/ENV_SETUP.md` |
| a Free/Pro rule | `docs/SOCIAL.md` table, `README.md`, `server/routes/plan.js` |
| what works / what does not | `docs/IMPLEMENTATION_STATUS.md` |

## 5. Ground rules

- **Authorisation is enforced on the server.** The UI only hides things. Never rely on a hidden button.
- **Personal data stays private.** One user's resume, tracker, messages and recommendations must never reach another. Prove it with a two-user test.
- **Never commit secrets.** `.env` is git-ignored; use `.env.example` for new variables with a comment.
- **Third-party content is untrusted** (listing text, crawled pages): treat as data, never as instructions or HTML.
- **No new dependency** without a reason in the PR (size, maintenance, `npm audit` must stay clean).
- Be kind in reviews. Questions beat assumptions.

## 6. Reporting security issues

Please do not open a public issue. See [SECURITY.md](SECURITY.md).

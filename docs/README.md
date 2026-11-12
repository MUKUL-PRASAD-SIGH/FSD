# HackElite documentation

Start with the row that matches what you want to do.

| I want to… | Read |
|---|---|
| **Understand the whole project** (and explain it to someone) | [CODEBASE_GUIDE.md](CODEBASE_GUIDE.md): feature-by-feature with file paths, low-level mechanics, demo script, viva questions |
| **Run it** locally or in Docker | [README](../README.md#quick-start) → [ENV_SETUP.md](ENV_SETUP.md) for keys |
| **Deploy it** | [DEPLOYMENT.md](DEPLOYMENT.md): Docker, reverse proxy + WebSockets, env checklist, scaling limits, go-live list |
| **Call the API** | [API.md](API.md): all 105 routes with access rules, plus the WebSocket protocol |
| **Test it** | [TESTING.md](TESTING.md): the layers, every test file, the live end-to-end run |
| **Know how it is designed** | [ARCHITECTURE.md](ARCHITECTURE.md): flows, recommendation engine, ingestion, RAG, operations, scaling trade-offs |
| **Review security and privacy** | [SECURITY.md](SECURITY.md): every control with the test that proves it, plus the honest list of gaps |
| **Understand teams, chat and Free vs Pro** | [SOCIAL.md](SOCIAL.md) |
| **Understand the crawler and question privacy** | [CRAWLER.md](CRAWLER.md): what it does, what it refuses to do, legal posture |
| **See what works and what does not** | [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) |
| **Contribute** | [../CONTRIBUTING.md](../CONTRIBUTING.md) |
| **Report a vulnerability** | [../SECURITY.md](../SECURITY.md) |

## Folder layout
```
docs/
├── README.md                  this index
├── CODEBASE_GUIDE.md          the complete code guide (start here for understanding)
├── API.md · ARCHITECTURE.md · DEPLOYMENT.md · TESTING.md
├── SECURITY.md · SOCIAL.md · CRAWLER.md
├── ENV_SETUP.md               where to get every key, step by step
├── IMPLEMENTATION_STATUS.md   verified vs unverified, known gaps
├── assets/                    screenshots used by the README
└── reports/                   historical audit and test reports (kept for the record)
```

## Keeping docs honest
Docs that describe behaviour are updated in the same pull request as the code (see the table in [CONTRIBUTING.md](../CONTRIBUTING.md#4-where-things-live)). The route list in [API.md](API.md) is generated from the code; claims in [SECURITY.md](SECURITY.md) name the test that proves them.

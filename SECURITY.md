# Security policy

## Reporting a vulnerability
Please **do not** open a public issue for security problems.

1. Email the maintainer (see the repository owner's GitHub profile) or use GitHub's **Report a vulnerability** button on the *Security* tab.
2. Include what you found, how to reproduce it, and the impact you expect.
3. You will get an acknowledgement within a few days; fixes are coordinated before any public disclosure.

## Scope
The API (`server/`), the web app (`client/`), the Docker image, and the documented deployment settings.
Out of scope: third-party sites HackElite links to or reads (Devpost, Unstop, Devfolio, …) and your own infrastructure.

## What is already protected
Authentication and sessions, authorisation, rate limiting, input sanitising, SSRF-safe crawling, chat and WebSocket access control, privacy of resumes, messages and recommendations, and dependency hygiene are documented with the tests that prove them in [docs/SECURITY.md](docs/SECURITY.md).

## Known, documented gaps
Listed honestly in [docs/SECURITY.md](docs/SECURITY.md#known-gaps-and-residual-risks-honest-list) (for example: JWT in `localStorage`, no CAPTCHA, soft email verification).

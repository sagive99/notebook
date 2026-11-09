---
status: accepted
date: 2026-11-09
scope:
  - hosting
  - delivery
supersedes: []
---

# 0002: Static PWA on GitHub Pages

## Context

The owner wants the app on his iPhone, always one tap away, delivered as a web app added to the home screen and deployed from GitHub at the usual GitHub Pages URL. It is a single-user tool; running and paying for a server is not wanted. iOS supports home-screen web apps with standalone display and, since iOS 16.4, web push only for installed apps.

## Decision

- Ship `@notebook/web` as a static single-page PWA built by Vite and deployed by GitHub Actions to GitHub Pages at `https://sagive99.github.io/notebook/`.
- The repository is public, as free GitHub Pages requires. It contains no secrets: the Google OAuth client ID is public by design and is supplied as the repository variable `GOOGLE_CLIENT_ID` at build time.
- No backend of our own. Every integration runs from the browser against Google APIs with the user's token.
- A service worker precaches the app shell so it opens offline; navigation uses hash routes so Pages needs no rewrite rules.
- Reminders use Google Calendar alerts rather than web push, because web push needs a server to send messages (see ADR 0005).

## Alternatives considered

- **Native iOS app:** best device integration (Apple Reminders via EventKit), but needs a Mac toolchain and App Store or TestFlight distribution; rejected for now.
- **Vercel/Netlify with serverless functions:** would enable push and token refresh, but adds an account, secrets, and operations; rejected per the owner's GitHub requirement.
- **Private repository:** would need a paid GitHub plan for Pages.

## Consequences

- Zero hosting cost and no server to secure.
- No push notifications from the app itself; no background work while the app is closed.
- Apple Reminders cannot be reached from the web; Google Calendar alerts cover reminders instead.
- iOS may evict web app storage after long inactivity; Drive sync (ADR 0003) is the durable copy.

## Verification

- `.github/workflows/deploy.yml` builds with `VITE_BASE_PATH=/notebook/` and deploys `apps/web/dist` to Pages.
- The built app has a manifest with `display: standalone`, home-screen icons, and a service worker.

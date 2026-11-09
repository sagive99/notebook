---
status: proposed
date: 2026-11-09
scope:
  - authentication
  - security
  - "@notebook/web"
supersedes: []
---

# 0004: Browser OAuth token model

## Context

All Google access happens in the browser (ADR 0002). Long-lived refresh tokens require a confidential client, which means a server. iOS home-screen apps are often killed in the background, so a memory-only token would demand a Google tap on nearly every open.

## Decision

- Use the Google Identity Services **token model** (`initTokenClient`) with the public web client ID. Tokens last about an hour; no refresh tokens and no client secret exist anywhere.
- Base scopes, requested on Connect: `drive.appdata` and `calendar.events`. `gmail.readonly` is requested **incrementally**, only when the user enables the Gmail block; `calendar.calendarlist.readonly` likewise, only when the user taps Choose under Customize → Calendars on Schedule.
- Cache the current access token, its expiry, and granted scopes in `localStorage` until one minute before expiry, so reopening the app within the hour needs no tap. After expiry the app keeps working on the device copy and shows a one-tap Reconnect. A 401 from Google clears the cached token.
- Calls that may open Google's popup run only from user gestures (Connect, Reconnect, Allow).
- Disconnect revokes the token and clears the cache.

## Alternatives considered

- **Memory-only token:** smaller exposure window, but a reconnect on almost every app open on iOS.
- **Authorization-code flow with a backend:** silent refresh, but requires a server (rejected in ADR 0002).
- **Request every scope at once:** simpler, but asks for mailbox access the user may never use.

## Consequences

- An XSS bug could read a token valid for up to an hour. Mitigations: no third-party scripts besides Google's sign-in script, no HTML rendering of user or API text, Zod validation at boundaries.
- Daily use costs one Reconnect tap when the hour has passed; data is never blocked by it.
- `gmail.readonly` is a restricted scope: while the OAuth app stays in Testing mode with the owner as test user, Google shows an unverified-app screen. Publishing to other users would require verification.

## Verification

- `apps/web/src/adapters/google/auth.ts` is the only code that requests or stores tokens.
- No `client_secret`, refresh token, or token logging exists in the repository.
- Scopes in code match this ADR.

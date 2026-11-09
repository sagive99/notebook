# Architecture Decision Records

Accepted records define current policy for their declared scope; proposed records remain under discussion. Workspace-local indexes are created with a workspace's first scoped decision.

## Find the relevant decision

1. Match the task against the scopes below.
2. Read only the applicable records.
3. Use the affected workspace's `AGENTS.md` and `CONTEXT.md` for its current implementation mapping.

### Repository guidance

| ADR | Status | Scope | Decision |
| --- | --- | --- | --- |
| [0001: Shared standards and scoped agent context](./0001-shared-standards-and-scoped-agent-context.md) | Accepted | Repository agent configuration | One shared standards source, scoped workspace guidance, and canonical cross-harness routing, as in the BlackTube monorepo. |

### Product architecture

| ADR | Status | Scope | Decision |
| --- | --- | --- | --- |
| [0002: Static PWA on GitHub Pages](./0002-static-pwa-on-github-pages.md) | Accepted | Hosting, delivery | Ship a static installable web app from GitHub Pages; no server of our own. |
| [0003: Drive app-data document with entity merge](./0003-drive-app-data-document-with-entity-merge.md) | Accepted | Storage, sync | Store one notebook JSON document in the Drive app-data folder and on the device; reconcile by per-entity last-writer-wins merge with tombstones. |
| [0004: Browser OAuth token model](./0004-browser-oauth-token-model.md) | Proposed | Authentication, security | Use Google Identity Services short-lived access tokens, cached on the device until expiry; minimal scopes with Gmail requested incrementally. |
| [0005: Google Calendar as the calendar hub](./0005-google-calendar-as-calendar-hub.md) | Accepted | Calendar, reminders | Integrate with Google Calendar only; iPhone Calendar mirrors it. Reminders are calendar events linked two ways to items. |
| [0006: Workspace layering](./0006-workspace-layering.md) | Accepted | `@notebook/core`, `@notebook/web` | Pure domain package; app layered as UI → state → ports ← adapters, enforced by dependency-cruiser. |

## When to record a decision

Consider an ADR when a change is hard to reverse, changes the stored document format or sync semantics, adds an OAuth scope or external service, changes hosting, or changes dependency direction.

Routine fixes, localized refactors, ordinary feature work, and mechanical dependency updates usually need no ADR. Every significant PR should state whether one was considered.

Use [ADR-TEMPLATE.md](./ADR-TEMPLATE.md). New decisions start as proposed; mark them accepted only after explicit agreement.

## Statuses

- **Proposed:** under discussion and not binding.
- **Accepted:** the current decision for its declared scope.
- **Rejected:** considered but not adopted.
- **Superseded:** replaced by an accepted later decision.
- **Deprecated:** retained but no longer recommended.

---
status: accepted
date: 2026-11-09
scope:
  - "@notebook/core"
  - "@notebook/web"
supersedes: []
---

# 0006: Workspace layering

## Context

The app's riskiest logic (carry-over, capture parsing, merge) must be testable without a browser, and storage or calendar providers may change later (for example Supabase, or a native shell). The monorepo's hexagonal services keep core logic independent of infrastructure; a lighter form of that fits a small PWA.

## Decision

- `@notebook/core` holds schemas, entity types, pure commands, selectors, capture parsing, and merge. It depends only on Zod and never on the app, Preact, or browser APIs. Time and ids enter through `CommandContext`.
- `@notebook/web` is layered:
  - `ports.ts`: interfaces for remote and local document stores, calendar, and mail.
  - `adapters/`: Google (auth, Drive, Calendar, Gmail) and local-storage implementations of the ports. Adapters never import `state/` or `ui/`.
  - `state/`: `NotebookStore`, `CalendarSync`, hooks, and `app-services.ts`, the only composition root that constructs adapters.
  - `ui/`: screens, blocks, sheets, components. UI depends on `state/`, `ports.ts`, and core, never on `adapters/`.
- `pnpm validate:deps` (dependency-cruiser) enforces these rules and forbids cycles.

## Alternatives considered

- **Single flat app folder:** faster to start, but merge and sync logic would mix with UI and become hard to test.
- **Full hexagonal service structure with modules:** too much ceremony for one UI app.

## Consequences

- Core and state logic run in Vitest without a browser.
- A new provider means a new adapter plus wiring in `app-services.ts`.

## Verification

- `.dependency-cruiser.cjs` rules `core-stays-pure`, `ui-uses-ports-not-adapters`, `adapters-do-not-know-ui-or-state`, and `no-circular` pass in CI.

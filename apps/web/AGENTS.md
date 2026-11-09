# @notebook/web instructions

Inherits the root [AGENTS.md](../../AGENTS.md) and [standards](../../docs/STANDARDS.md). Read [CONTEXT.md](./CONTEXT.md) first.

## Stack

- Preact 11 with hooks, TypeScript (strict), Vite 8, `vite-plugin-pwa` (generateSW), Zod 4 at boundaries.
- No router or state library: hash routes in `src/ui/router.ts`; state in `NotebookStore` with `useExternal`-style subscriptions in `src/state/hooks.ts`.
- Styles are plain CSS in `src/styles.css` with the design tokens from the approved design canvas. No CSS framework.

## Layout and dependency direction

- `src/ports.ts`: interfaces and typed errors. `src/adapters/`: implementations. `src/state/`: store, calendar sync, hooks, composition root (`app-services.ts`). `src/platform/`: domain-free browser utilities. `src/ui/`: screens, blocks, sheets, components.
- UI never imports `adapters/`; in `state/` only `app-services.ts` does. Adapters never import `state/` or `ui/`. Enforced by `pnpm validate:deps` ([ADR 0006](../../docs/adr/0006-workspace-layering.md)).
- Domain changes (schemas, commands, selectors) go in `@notebook/core`, not here.

## Rules

- Every Google response is parsed with a Zod schema in its adapter. Map failures to `AuthRequiredError`, `OfflineError`, `GoogleApiError`, or `ConflictError`.
- Changes go through `store.run(command)`; never mutate the document.
- Sheets edit a draft and apply on Save. Destructive actions ask for confirmation inline.
- Google popups (`connect`, `connectGmail`) only from click handlers.
- New screens get a hash route in `router.ts` and a bottom-nav mapping in `components/chrome.tsx`.
- App shell (iOS home-screen apps strand fixed bars after an input zooms the viewport): the page never scrolls, only `<main class="app-main">` does. No `position: fixed` and no `window.scrollTo` in screens; bottom actions use `CaptureBar` (sticky inside the scroller). Form controls stay at 16px or larger so iOS doesn't zoom on focus.

## Checks

- `pnpm --filter @notebook/web test` (Vitest, happy-dom; `*.unit.test.ts(x)`).
- `pnpm --filter @notebook/web type-check` and `pnpm --filter @notebook/web lint`.
- `VITE_BASE_PATH=/notebook/ pnpm --filter @notebook/web build`, then `vite preview` with the same variable and check the changed screens at 390×844. For layout changes, also check that `window.scrollY` stays 0 and the nav stays at the bottom after focusing an input; confirm on a real iPhone home-screen app after deploy.

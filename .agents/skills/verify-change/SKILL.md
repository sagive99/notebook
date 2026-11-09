---
name: verify-change
description: Selects and runs proportionate repository checks for the current diff, then reports exact evidence without hiding failures or skipped checks. Use when implementation appears complete, before a PR, or when the user asks to verify, validate, test, lint, type-check, or build a change.
---

# Verify a Change

## Inspect scope

1. Read root and relevant scoped `AGENTS.md`.
2. Inspect `git status` and the diff from the intended base.
3. List affected workspaces, the document schema, ports, adapters, UI screens, and documentation.
4. Identify behavior changes, not only edited files.

## Select checks

- Documentation only: `pnpm lint:md`, `pnpm skills:validate`, and link/path checks.
- `@notebook/core`: `pnpm --filter @notebook/core test type-check lint`, then the web tests (they consume core).
- `@notebook/web` logic (state, adapters): focused Vitest files, then the workspace suite, type check, and lint.
- UI: build with `VITE_BASE_PATH=/notebook/`, run `vite preview` with the same variable, and inspect the changed screens at 390×844 (Playwright screenshots are fine).
- Imports or layers changed: `pnpm validate:deps`.
- Schema changed: follow `change-document-schema` as well.
- Broad change: `pnpm affected` or the full graph (`pnpm build test lint type-check`).

## Execute safely

1. Run the narrowest meaningful test first.
2. Expand to the workspace suite when the focused check passes.
3. Run type checking, lint, and build as required by scope.
4. Stop and diagnose failures caused by the change; do not rewrite correct behavior to satisfy a faulty test.
5. Do not install dependencies or change configuration just to make a check runnable without authorization.

## Report

Report the affected scope, each exact command, pass/fail/not-run status, concise failure causes, files changed by verification, and residual risk. A skipped, unavailable, timed-out, or flaky check is not a pass.

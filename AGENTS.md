# Notebook Agent Guide

This is the canonical repository instruction router. **Read and follow [docs/STANDARDS.md](./docs/STANDARDS.md) for every repository task; its shared rules are part of these instructions.** Scoped `AGENTS.md` files inherit these instructions and add directory-specific guidance.

## Repository facts

- Notebook is Sagiv's personal planning app: a Today page that replaces a paper work notebook, plus Spaces he configures himself. It is an installable web app (PWA) for iPhone.
- It is a static site on GitHub Pages with no server. Google Calendar, Google Drive (app data), and Gmail are called directly from the browser with the user's own OAuth token.
- CI uses Node.js 22; workspace tooling is pnpm and Turborepo.
- Workspaces are `apps/*` and `packages/*`, as declared in [pnpm-workspace.yaml](./pnpm-workspace.yaml).
- The [shared TypeScript base](./tsconfig.base.json) enables strict mode with `noUncheckedIndexedAccess`; each workspace's configuration remains authoritative.

## Start with context

1. Inspect `git status` and preserve unrelated user changes.
2. Read [CONTEXT.md](./CONTEXT.md) for shared language.
3. Use [CONTEXT-MAP.md](./CONTEXT-MAP.md) to identify affected workspaces, ports, and integrations.
4. Before changing, diagnosing, or reviewing a workspace, read its scoped `AGENTS.md` and `CONTEXT.md`.
5. Before an architectural, storage, sync, or security decision, read [the ADR index](./docs/adr/README.md) and the decisions whose scope matches the change.

## Workspace commands

Run commands from the repository root.

- Full graph: `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm type-check`.
- Changed workspaces: `pnpm affected`.
- Dependency boundaries: `pnpm validate:deps`.
- Markdown: `pnpm lint:md`.
- One workspace: `pnpm --filter <workspace-name> <script>`.
- Local app: `pnpm dev` (local-only mode unless `apps/web/.env.local` sets `VITE_GOOGLE_CLIENT_ID`).
- Use normal `pnpm install` when dependencies change. Never use `--force`, delete `node_modules`, or run installs in the background unless explicitly requested.

## Repository skills

Use a skill when the request matches its description. Canonical repository skills live under `.agents/skills`; see [skill governance](./docs/ai/skill-governance.md).

- `to-pr`: prepare or explicitly publish a pull request.
- `verify-change`: select and run proportionate checks before declaring completion.
- `add-adr`: record a durable architectural decision in the correct scope.
- `code-review`: review a pull request or diff with the specialist lenses (spec, architecture, security, performance, hygiene) and publish one tiered review.
- `change-document-schema`: change the stored notebook document shape (`@notebook/core` schemas) without breaking existing Drive and device copies.

## Before declaring completion

1. Inspect the final diff and remove unrelated changes.
2. Select checks proportional to the changed scope (`verify-change`).
3. Run focused tests for changed behavior, then the workspace type check and lint.
4. Run `pnpm validate:deps` when imports or layer boundaries change.
5. For UI changes, build the app and look at the affected screens at phone width (390×844).
6. Report exact commands, outcomes, failures, and checks that could not run.

A failed or skipped required check must never be reported as a pass. Every significant PR states whether an ADR was considered.

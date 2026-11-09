# @notebook/core instructions

Inherits the root [AGENTS.md](../../AGENTS.md) and [standards](../../docs/STANDARDS.md). Read [CONTEXT.md](./CONTEXT.md) first.

## Rules

- Pure TypeScript plus Zod. No browser APIs, no Preact, no imports from apps (`core-stays-pure` in `pnpm validate:deps`).
- Commands take `(document, input, context)` and return a new document; unchanged entities keep their object identity (the app relies on it to detect changes).
- Every command that changes an entity sets `updatedAt` from `context.now`. Deletions set `deleted: true` instead of removing.
- Schema changes follow the `change-document-schema` skill: new fields need defaults so older documents still parse.

## Checks

- `pnpm --filter @notebook/core test`, `type-check`, `lint`.

# @notebook/core context

The domain model of the notebook, shared by every device and app version.

## Modules

| File | Responsibility |
| --- | --- |
| `schemas.ts` | Zod schemas for the stored document; the authoritative contract. |
| `types.ts` | Types inferred from the schemas, plus `CommandContext`. |
| `document.ts` | `createDocument` and pure commands for items, people, spaces, settings. |
| `selectors.ts` | Day pages with carry-over, space items, team summary, Today blocks, search. |
| `capture.ts` | Quick-capture parsing (`@person`, `#tag`, day words in English and Hebrew, times) and the evening default. |
| `merge.ts` | Entity merge, tombstone pruning, and validated parsing of stored documents. |
| `dates.ts` | Local-date helpers (weeks start on Sunday). |

## Invariants

- `mergeDocuments` is commutative and idempotent.
- `parseDocument` is the only way stored data becomes a `NotebookDocument`.
- A new document contains two starter spaces, "Team" (people layout) and "Ideas backlog" (list), referenced from settings.

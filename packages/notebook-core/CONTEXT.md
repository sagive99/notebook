# @notebook/core context

The domain model of the notebook, shared by every device and app version.

## Modules

| File | Responsibility |
| --- | --- |
| `schemas.ts` | Zod schemas for the stored document; the authoritative contract. |
| `types.ts` | Types inferred from the schemas, plus `CommandContext`. |
| `document.ts` | `createDocument` and pure commands for items (incl. `setItemOngoing`, `placeItemBefore`, `scheduleItem`), people, spaces, settings. |
| `selectors.ts` | Day pages with carry-over (ongoing first), space items, per-person ongoing/up-next lists, Today blocks. |
| `search.ts` | Grouped search, quick filters, and match highlighting parts. |
| `board.ts` | Board column rules. |
| `capture.ts` | Quick-capture parsing (`@person`, `#tag`, day words in English and Hebrew, times) and the evening default. |
| `merge.ts` | Entity merge, tombstone pruning, and validated parsing of stored documents. |
| `dates.ts` | Local-date helpers (weeks start on Sunday). |

## Invariants

- `mergeDocuments` is commutative and idempotent.
- `parseDocument` is the only way stored data becomes a `NotebookDocument`.
- `Person.now` is deprecated (replaced by ongoing tasks) but kept in the schema so older app versions still parse new files.
- Finishing an ongoing task keeps `ongoingSince`, so Undo returns it to ongoing; `isOngoing` means set and not done.
- A new document contains two starter spaces, "Team" (people layout) and "Ideas backlog" (list), referenced from settings.

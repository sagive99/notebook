# @notebook/core context

The domain model of the notebook, shared by every device and app version.

## Modules

| File | Responsibility |
| --- | --- |
| `schemas.ts` | Zod schemas for the stored document; the authoritative contract. |
| `types.ts` | Types inferred from the schemas, plus `CommandContext`. |
| `document.ts` | `createDocument` and pure commands for items (incl. `setItemOngoing`, `placeItemBefore`, `scheduleItem`), people, spaces, settings (incl. `setTodayBlockCollapsed`, `dismissEmail`, `restoreEmail`). |
| `selectors.ts` | Day pages with carry-over (ongoing first), notebook sections (`notebookSections`, `selfPersonId`), space items, per-person ongoing/up-next lists, Today blocks. |
| `search.ts` | Grouped search, quick filters, and match highlighting parts. |
| `board.ts` | Board column rules. |
| `people.ts` | People-board drops (`moveTaskOnPeopleBoard`) and converting the legacy "now" note (`resolveLegacyNow`). |
| `capture.ts` | Quick-capture parsing (`@person`, `#tag`, day words in English and Hebrew, times) and the evening default. |
| `merge.ts` | Entity merge, tombstone pruning, and validated parsing of stored documents. |
| `dates.ts` | Local-date helpers (weeks start on Sunday). |

## Invariants

- `mergeDocuments` is commutative and idempotent.
- `parseDocument` is the only way stored data becomes a `NotebookDocument`.
- `Person.now` is deprecated (replaced by ongoing tasks) but kept so a save from this version doesn't erase text older versions still show; the People board offers to convert it.
- An older app version drops `ongoingSince` when it saves an item; accepted, the task falls back to up next (tested).
- `placeItemBefore` renumbers the siblings when two neighbours have no gap left.
- Work is derived, never stored per item: `isWorkItem` (person link or work space) and `isWorkSpace` (`Space.work`, null = People layout). `dayPage(..., { hideWork })`, `withoutWork`, `isWorkEvent`, and `visibleTodayBlocks` apply the Today Work switch.
- Merge tie-break on equal timestamps: tombstone, then fewer null fields (restores fields an older version dropped), then content order.
- Finishing an ongoing task keeps `ongoingSince`, so Undo returns it to ongoing; `isOngoing` means set and not done.
- `Settings.collapsedBlocks` and `Settings.dismissedEmails` were added after v1 with defaults; an older app version drops them when it saves settings (accepted: blocks reopen, dismissed emails come back). `dismissEmail` forgets dismissals older than 14 days, since the Gmail block lists only the last 7 days.
- The Today block id `gmail-starred` is kept for stored compatibility; the block shows new important mail.
- `Settings.selfPersonId`, `notebookCollapsedSections`, `notebookSectionColors` and `Person.color` were added after v1 with defaults; an older app version drops them when it saves (accepted: sections reopen in default colours, the person falls back to a positional colour, "me" falls back to the name rule). Section ids are stored as plain strings so a later section doesn't invalidate the document here.
- `notebookSections` splits a day page for the Notebook block; a carried task of a team member sits in Team, so folding Team hides every team task.
- A new document contains two starter spaces, "Team" (people layout) and "Ideas backlog" (list), referenced from settings.

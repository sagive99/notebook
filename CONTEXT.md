# Notebook Domain Context

Notebook is one person's working memory: the day's schedule, tasks and notes on a single page, plus self-built Spaces for everything that is not about today. It replaces a paper notebook carried at work, including the pages that track what each team member is doing.

This document defines shared language and system-wide invariants. [CONTEXT-MAP.md](./CONTEXT-MAP.md) locates workspaces, ports, and integrations. Working instructions live in `AGENTS.md`; shared engineering rules live in [docs/STANDARDS.md](./docs/STANDARDS.md).

## Capabilities

- **Today page:** one day at a time: calendar events, the notebook (tasks and notes for the day), and blocks pinned from Spaces. The user chooses and orders the blocks.
- **Quick capture:** one text box, available everywhere. Understands `@person`, `#tag`, day words ("tomorrow", "מחר") and times ("14:30").
- **Spaces:** user-created sections with a layout (list, board, people, notes) and chosen item fields. The ideas backlog and the team board are ordinary Spaces.
- **People:** one team roster shared by every People-layout space: a "now" line (what they are working on), a blocked flag, linked open tasks, and running 1:1 notes.
- **Calendar sync:** two-way link with Google Calendar, which the iPhone Calendar mirrors.
- **Backup and multi-device sync:** the whole notebook is stored in the user's Google Drive app-data folder and on each device.

## Language

| Term | Meaning |
| --- | --- |
| Notebook document | The single JSON document holding all items, people, spaces and settings. Versioned by `version`. |
| Item | One entry: a **task** (checkable), **note** (text), or **idea** (backlog entry). |
| Day | A local calendar date (`YYYY-MM-DD`). An item with a day appears on that day's page. |
| Notebook item | An item with no space. |
| Space | A user-defined section with a layout and fields. Items may belong to one space. |
| Pinned / Show on Today | A space whose dated items appear on day pages, or whose block is enabled on Today. |
| Carried over | An unfinished task from an earlier day, shown on today's page until done or moved. |
| Evening cutoff | The time (default 18:00) after which new captures default to tomorrow morning. |
| Calendar + reminder | An item flag: the item has a Google Calendar event with a popup alert. |
| Waiting on | Open tasks linked to a person. |
| Blocked | A person flagged as stuck on something outside their control. |
| Check in | A person whose "now" line has not been updated for 3+ days. |
| Tombstone | A deleted entity kept with `deleted: true` so deletions survive merging. |

## Invariants

- The device copy is written before any network call; the app is fully usable offline and in local-only mode.
- Every stored document (Drive file or device cache) is validated with the `@notebook/core` schema before use. Invalid remote data never overwrites the device copy.
- Merging is per entity, last-writer-wins by `updatedAt`, with tombstones winning ties; merge is commutative and idempotent ([ADR 0003](./docs/adr/0003-drive-app-data-document-with-entity-merge.md)).
- OAuth tokens are never logged or sent anywhere but Google APIs; refresh tokens are never used ([ADR 0004](./docs/adr/0004-browser-oauth-token-model.md)).
- An item's calendar event is derived from the item; the item is the source of truth, except that calendar-side moves and deletions flow back to it ([ADR 0005](./docs/adr/0005-google-calendar-as-calendar-hub.md)).

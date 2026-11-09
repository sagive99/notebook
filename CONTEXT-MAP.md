# Notebook Context Map

Use this index to locate the smallest relevant context. Read [shared language](./CONTEXT.md) and the required [shared standards](./docs/STANDARDS.md), then the scoped instructions, context, and applicable ADRs for the affected workspace.

## Workspaces

| Workspace | Responsibility | Scoped documents |
| --- | --- | --- |
| [`@notebook/web`](./apps/web) | Installable web app: UI, state, Google adapters, PWA shell | [Context](./apps/web/CONTEXT.md), [instructions](./apps/web/AGENTS.md) |
| [`@notebook/core`](./packages/notebook-core) | Domain model: schemas, commands, selectors, capture parsing, merge | [Context](./packages/notebook-core/CONTEXT.md), [instructions](./packages/notebook-core/AGENTS.md) |

## Contracts

| Contract | Owner | Participants |
| --- | --- | --- |
| Notebook document schema (`notebookDocumentSchema`) | `@notebook/core` | Device cache (`localStorage`), Drive file `notebook.json`, every device running any app version. Change with `change-document-schema`. |
| Ports (`apps/web/src/ports.ts`) | `@notebook/web` | State layer consumes; Google and local adapters implement. |
| Calendar event link | `@notebook/web` | Events carry `extendedProperties.private.notebookItemId`; items carry `calendarEventId`. |

## Runtime flow

```text
iPhone home screen (PWA, GitHub Pages)
        |
        v
   UI (Preact) --run(command)--> NotebookStore --save--> localStorage (device copy)
        |                             |
        |                             +--debounced sync--> Drive app data: notebook.json
        |                             |                     (load, merge, save with version check)
        |                             v
        |                       CalendarSync --create/update/delete--> Google Calendar (primary)
        |                             ^                                       |
        +-- Schedule block --listDay--+---- reconcile moves/deletes ----------+
        |                                                                     |
        +-- Gmail block --list starred (read-only)--> Gmail          iPhone Calendar (account sync)

Google Identity Services --access token (1h)--> GoogleAuth --> every Google adapter
```

## Decision routing

- Repository decisions: [ADR index](./docs/adr/README.md).
- Agent guidance scope: [ADR 0001](./docs/adr/0001-shared-standards-and-scoped-agent-context.md).
- Hosting and the no-backend constraint: [ADR 0002](./docs/adr/0002-static-pwa-on-github-pages.md).
- Storage and sync: [ADR 0003](./docs/adr/0003-drive-app-data-document-with-entity-merge.md).
- Authentication: [ADR 0004](./docs/adr/0004-browser-oauth-token-model.md).
- Calendar and reminders: [ADR 0005](./docs/adr/0005-google-calendar-as-calendar-hub.md).
- Layering and dependency direction: [ADR 0006](./docs/adr/0006-workspace-layering.md).
- Workspace-local ADR directories are created with the first real scoped decision; do not create empty ADR collections.

# @notebook/web context

The installable web app. It renders the Today page, quick capture, Spaces, People, Search, and Customize screens from the approved design, keeps the notebook on the device, and talks to Google from the browser.

## Architecture

```text
ui/ (Preact screens, blocks, sheets)
  │ uses
  ▼
state/ NotebookStore ── CalendarSync ── hooks ── app-services (composition root)
  │ depends on
  ▼
ports.ts  ◄── implemented by ── adapters/ (google/auth, drive-store, calendar, gmail; local-store)
```

- `NotebookStore` applies `@notebook/core` commands, writes the device copy, and syncs with the remote store by merging ([ADR 0003](../../docs/adr/0003-drive-app-data-document-with-entity-merge.md)). Status values: `local-only`, `signed-out`, `needs-auth`, `pending`, `syncing`, `synced`, `offline`, `error`.
- `CalendarSync` keeps "Calendar + reminder" items and their events linked both ways and queues work while offline ([ADR 0005](../../docs/adr/0005-google-calendar-as-calendar-hub.md)).
- `GoogleAuth` owns the short-lived token ([ADR 0004](../../docs/adr/0004-browser-oauth-token-model.md)).

## Modes

- **Local-only:** built without `VITE_GOOGLE_CLIENT_ID`. Everything works on the device; calendar and Gmail blocks explain the setup.
- **Connected:** built with a client ID. Connect asks for Drive app data and Calendar; Gmail is asked separately.

## Screens

| Route | Screen |
| --- | --- |
| `#/today` (default) | Today: header, week strip, enabled blocks, capture bar |
| `#/customize` | Block order and visibility, notebook rules, account and sync |
| `#/spaces`, `#/space/<id>`, `#/space-settings/<id>`, `#/new-space` | Spaces grid, a space in its layout, space settings, creation |
| `#/people` | People board: ongoing and up-next tasks per person, ▶ and drag to set ongoing, ✓ kept until leaving |
| `#/search` | Search: type filters, quick filters, people row, recent searches, grouped highlighted results |

## Invariants

- The UI renders whatever the store holds; it never waits on the network to show the notebook.
- User text is rendered as text with `dir="auto"`.
- Only `http(s)` links are stored and opened.

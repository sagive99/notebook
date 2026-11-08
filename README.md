# Notebook

Your day on one page, plus the spaces you build yourself. A personal replacement for a paper work notebook: the day's calendar, tasks and notes; carried-over tasks; quick capture from anywhere; customizable Spaces (backlog, team board, projects, notes); and a People board for tracking what each team member is doing.

- **App:** <https://sagive99.github.io/notebook/> (add to the iPhone home screen from Safari)
- **Design:** [approved canvas](https://claude.ai/artifact/5eBcxCgArbzihsCszUpA7H)
- **Setup:** [Google setup guide](./docs/setup/google-cloud.md). Until it is done, the app runs in local-only mode.

## How it works

A static PWA on GitHub Pages ([ADR 0002](./docs/adr/0002-static-pwa-on-github-pages.md)). The notebook is saved on the device first and synced to a private file in your Google Drive ([ADR 0003](./docs/adr/0003-drive-app-data-document-with-entity-merge.md)). Google Calendar is linked both ways, and "Calendar + reminder" items become calendar events with alerts ([ADR 0005](./docs/adr/0005-google-calendar-as-calendar-hub.md)).

## Develop

```bash
pnpm install
pnpm dev            # http://localhost:5173
pnpm test           # unit tests
pnpm lint && pnpm type-check && pnpm validate:deps
```

Agents and contributors start at [AGENTS.md](./AGENTS.md).

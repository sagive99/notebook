---
status: proposed
date: 2026-11-09
scope:
  - apps/web
supersedes: []
---

# 0007: iPhone Reminders through a user-installed Shortcut

## Context

Sagiv wants items marked "Calendar + reminder" to appear in the iPhone Reminders app, not only as Google Calendar events. Notebook is a static web app ([ADR 0002](./0002-static-pwa-on-github-pages.md)): it has no API for Apple Reminders (EventKit is native-only) and no server that could talk to iCloud. The Google event alert set by [ADR 0005](./0005-google-calendar-as-calendar-hub.md) also doesn't reliably reach the phone, because the iPhone Calendar app often ignores per-event alerts on synced Google calendars.

## Decision

An opt-in, device-local handoff to an iPhone Shortcut named "Notebook Reminder", which the user builds once:

- When a save from the New or Edit sheet changes what an item's reminder should be (title, or day and time), the app opens `shortcuts://run-shortcut?name=Notebook%20Reminder&input=text&text=<json>` from that tap.
- The payload is `{"action":"add","tag":"notebook:<itemId>","title":…,"due":"YYYY-MM-DD HH:MM"}` or `{"action":"remove","tag":…}`. The Shortcut removes reminders whose notes contain the tag, then adds the new one with an alert at `due` and the tag in its notes.
- A day with no time gets an alert at 08:30.
- What was last sent per item is kept in `localStorage` (`notebook.reminders.sent`), so unchanged saves don't open Shortcuts. The on/off switch is `notebook.reminders.shortcut`. Neither key syncs.
- The handoff is one-way. The notebook never reads Reminders, and Google Calendar stays the synced record.

## Alternatives considered

- **Web Push from the PWA:** needs a push server and stored subscriptions. That means a backend, which ADR 0002 rules out for now.
- **iCloud CalDAV (VTODO):** needs an app-specific Apple password stored somewhere and a server or CORS proxy. That is unsafe and needs a backend.
- **A scheduled Shortcut automation that reads Google Calendar:** no app switch, but it only runs at fixed times, so a reminder added at 22:18 for 22:30 would be missed.
- **Relying only on the Google Calendar app:** reliable alerts, but nothing appears in Reminders, which is the stated requirement.

## Consequences

- Each relevant save briefly switches to the Shortcuts app; the user taps "‹ Notebook" to return.
- Changes made outside the two sheets don't reach Reminders until the item is next saved from a sheet. That covers ticking a task done, calendar-side moves, and edits on another device.
- The sent map is per device. Turning the handoff on later doesn't back-fill existing items.
- The Shortcut is built by hand from the steps in [docs/setup/iphone-reminders.md](../setup/iphone-reminders.md); iOS action names may differ by version and language.

## Verification

- `apps/web/src/state/reminders-handoff.unit.test.ts` covers when a link is produced and its payload.
- On a real iPhone: turn the handoff on in Customize, tap Test, and see a reminder alert two minutes later. Then edit an item's time and check that the Reminders app holds one updated reminder.

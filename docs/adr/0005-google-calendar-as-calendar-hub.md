---
status: accepted
date: 2026-11-09
scope:
  - calendar
  - reminders
  - "@notebook/web"
supersedes: []
---

# 0005: Google Calendar as the calendar hub

## Context

The owner wants calendar integration built into the app, two ways: events added in the app appear in his calendar, and calendar events appear in the app. He uses an iPhone. Web apps cannot reach iPhone Calendar or Apple Reminders, and Apple's Reminders are not available over CalDAV since iOS 13. The app also has no server to send push reminders (ADR 0002).

## Decision

- Integrate only with the user's **primary Google Calendar** (`calendar.events` scope). The iPhone Calendar shows the same events when the Google account is added under iOS Settings → Calendar → Accounts, so iPhone access comes through account sync.
- The Today page's Schedule block lists the day's events. Users can create, edit, and delete events from the app; those changes go straight to Google Calendar.
- An item flagged **Calendar + reminder** with a day gets a calendar event (timed if the item has a time, otherwise all-day) with a popup alert at the start time. That event is how the phone notifies the user.
- Link both ways: the event stores `extendedProperties.private.notebookItemId`; the item stores `calendarEventId`.
  - Item edits (text, day, time) update the event; turning the reminder off or deleting the item deletes the event.
  - When a day's events load, a linked event that moved (to another time or another day) or was renamed in the calendar updates the item, but only when the calendar edit is newer than the item's own `updatedAt`. A linked item whose event is missing from the day is looked up by id; only a deleted or cancelled event turns the item's reminder off.
- Pending calendar work is queued on the device and pushed when signed in, so offline or signed-out edits are not lost. Only local changes enqueue work; documents merged from other devices do not, which avoids duplicate events.
- Editing an existing event never resets its reminder settings unless the event belongs to a notebook item.

## Alternatives considered

- **Apple Reminders / iPhone Calendar directly:** impossible from a web app.
- **An iOS Shortcut bridge:** workable for one-way capture but fragile and manual; can be added later without changing this decision.
- **Web push for reminders:** needs a push server.
- **Every dated item becomes an event:** clutters the calendar; the explicit flag keeps the calendar meaningful.

## Consequences

- Reminders arrive through Google Calendar notifications on the iPhone.
- If two devices add the same reminder before either syncs the event id, a duplicate event can appear (rare; delete one).
- Calendar-side changes reach items when the item's day (or the event's new day) is viewed in the app.
- Writes go to the primary calendar. Other calendars (shared, subscribed) can be shown read-alongside: the user grants `calendar.calendarlist.readonly` and picks calendars in Customize. The pick is stored per device, not in the synced document. Only primary events take part in item linking.
- Which calendars are marked Work for the Today Work switch, and the switch position itself, are also per-device settings. Whether a space is work (`Space.work`) is part of the synced notebook.

## Verification

- `apps/web/src/state/calendar-sync.unit.test.ts` covers create, update, removal on reminder-off and delete, no-op pushes, calendar-side moves (same day and another day) and deletions, stale events never overwriting newer items, and queued work.

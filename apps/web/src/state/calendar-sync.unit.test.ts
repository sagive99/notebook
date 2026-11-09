import { addItem, deleteItem, updateItem, updateSettings } from '@notebook/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { CalendarSync } from './calendar-sync';
import { NotebookStore } from './notebook-store';
import { FakeCalendar, memoryLocalStore, sequentialIds } from './test-fakes';

const setup = () => {
  const calendar = new FakeCalendar();
  const store = new NotebookStore({ local: memoryLocalStore(), remote: null, newId: sequentialIds() });
  const sync = new CalendarSync(store, calendar);

  return { calendar, store, sync };
};

const addReminder = (store: NotebookStore, text: string, day: string, time: string | null): string => {
  const document = store.run((current, context) => addItem(current, { kind: 'task', text, day, time, remind: true }, context).document);

  return Object.values(document.items).find((item) => item.text === text)?.id ?? '';
};

describe('CalendarSync', () => {
  beforeEach(() => localStorage.clear());

  it('creates an event for a reminder item and links it back', async () => {
    const { calendar, store, sync } = setup();
    const id = addReminder(store, 'Call the bank', '2026-11-10', '08:30');
    await sync.flush();

    const item = store.getSnapshot().document.items[id];

    expect(calendar.calls).toEqual(['create:Call the bank']);
    expect(item?.calendarEventId).toBe('ev-1');
    expect(calendar.events.get('ev-1')).toMatchObject({ day: '2026-11-10', start: '08:30', notebookItemId: id });
  });

  it('updates the event when the item changes and removes it when the reminder is turned off or deleted', async () => {
    const { calendar, store, sync } = setup();
    const id = addReminder(store, 'Standup notes', '2026-11-10', '09:00');
    await sync.flush();

    store.run((current, context) => updateItem(current, id, { time: '10:00' }, context));
    await sync.flush();

    expect(calendar.events.get('ev-1')?.start).toBe('10:00');

    store.run((current, context) => updateItem(current, id, { remind: false }, context));
    await sync.flush();

    expect(calendar.events.size).toBe(0);
    expect(store.getSnapshot().document.items[id]?.calendarEventId).toBeNull();

    const second = addReminder(store, 'Gone soon', '2026-11-10', null);
    await sync.flush();
    store.run((current, context) => deleteItem(current, second, context));
    await sync.flush();

    expect(calendar.calls.at(-1)).toBe('remove:ev-2');
  });

  it('does not push when nothing calendar-relevant changed', async () => {
    const { calendar, store, sync } = setup();
    const id = addReminder(store, 'Same', '2026-11-10', '09:00');
    await sync.flush();
    store.run((current, context) => updateItem(current, id, { tags: ['x'] }, context));
    await sync.flush();

    expect(calendar.calls).toEqual(['create:Same']);
  });

  it('applies calendar-side moves and deletions to the item', async () => {
    const { calendar, store, sync } = setup();
    const moved = addReminder(store, 'Moved in Google', '2026-11-10', '09:00');
    const removed = addReminder(store, 'Deleted in Google', '2026-11-10', '11:00');
    await sync.flush();

    const event = [...calendar.events.values()].find((entry) => entry.notebookItemId === moved);
    const removedEventId = store.getSnapshot().document.items[removed]?.calendarEventId ?? '';

    calendar.editExternally(event?.id ?? '', { start: '15:30' });
    calendar.events.delete(removedEventId);
    await sync.reconcileDay('2026-11-10', await calendar.listDay('2026-11-10'));
    await sync.flush();

    const items = store.getSnapshot().document.items;

    expect(items[moved]?.time).toBe('15:30');
    expect(items[removed]).toMatchObject({ remind: false, calendarEventId: null });
    expect(calendar.calls.filter((call) => call.startsWith('update'))).toEqual([]);
  });

  it('follows an event moved to another day instead of unlinking it', async () => {
    const { calendar, store, sync } = setup();
    const id = addReminder(store, 'Moved to Thursday', '2026-11-10', '09:00');
    await sync.flush();
    const eventId = store.getSnapshot().document.items[id]?.calendarEventId ?? '';
    calendar.editExternally(eventId, { day: '2026-11-12', start: '16:00' });

    await sync.reconcileDay('2026-11-10', await calendar.listDay('2026-11-10'));

    expect(store.getSnapshot().document.items[id]).toMatchObject({ day: '2026-11-12', time: '16:00', remind: true, calendarEventId: eventId });
  });

  it('never lets an older calendar event overwrite a newer item edit', async () => {
    const { calendar, store, sync } = setup();
    const id = addReminder(store, 'Original', '2026-11-10', '09:00');
    await sync.flush();
    const eventId = store.getSnapshot().document.items[id]?.calendarEventId ?? '';
    const event = calendar.events.get(eventId);

    if (event) {
      calendar.events.set(eventId, { ...event, title: 'Stale title', updated: '2000-01-01T00:00:00.000Z' });
    }

    await sync.reconcileDay('2026-11-10', await calendar.listDay('2026-11-10'));

    expect(store.getSnapshot().document.items[id]?.text).toBe('Original');
  });

  it('queues work while signed out and pushes it once a calendar is available', async () => {
    const calendar = new FakeCalendar();
    const store = new NotebookStore({ local: memoryLocalStore(), remote: null, newId: sequentialIds() });
    const sync = new CalendarSync(store, null);
    addReminder(store, 'Later', '2026-11-11', null);

    expect(sync.getState()).toEqual({ kind: 'pending', count: 1 });

    sync.setGateway(calendar);
    await sync.flush();

    expect(calendar.calls).toEqual(['create:Later']);
    expect(sync.getState()).toEqual({ kind: 'idle' });
  });

  it('applies calendar edits to items on any day, not only the day on screen', async () => {
    const { calendar, store, sync } = setup();
    const moved = addReminder(store, 'Shave', '2026-11-12', '22:30');
    const removed = addReminder(store, 'Call the bank', '2026-11-13', '10:00');
    await sync.flush();
    const document = store.getSnapshot().document;
    calendar.editExternally(document.items[moved]?.calendarEventId ?? '', { title: 'Shave and shower', day: '2026-11-14', start: '21:00' });
    calendar.deleteExternally(document.items[removed]?.calendarEventId ?? '');

    await sync.reconcileChanges(new Date('2026-11-09T21:00:00.000Z'));
    await sync.flush();

    const items = store.getSnapshot().document.items;

    expect(items[moved]).toMatchObject({ text: 'Shave and shower', day: '2026-11-14', time: '21:00', remind: true });
    expect(items[removed]).toMatchObject({ remind: false, calendarEventId: null });
    expect(calendar.calls.filter((call) => call.startsWith('update') || call.startsWith('create:Shave and'))).toEqual([]);
  });

  it('asks only for changes since the last check, with a minute of overlap', async () => {
    const { calendar, sync } = setup();

    await sync.reconcileChanges(new Date('2026-11-09T21:00:00.000Z'));
    await sync.reconcileChanges(new Date('2026-11-09T21:02:00.000Z'));

    expect(calendar.calls.filter((call) => call.startsWith('listChanged'))).toEqual(['listChanged:2026-11-02T21:00:00.000Z', 'listChanged:2026-11-09T20:59:00.000Z']);
  });

  it('keeps reminders out of Google Calendar when the user turns that off, and puts upcoming ones back when on', async () => {
    const { calendar, store, sync } = setup();
    const upcoming = addReminder(store, 'Shave', '2030-01-10', '22:30');
    const past = addReminder(store, 'Old call', '2020-01-10', '09:00');
    await sync.flush();

    store.run((current, context) => updateSettings(current, { calendarForReminders: false }, context));
    await sync.flush();
    const created = addReminder(store, 'New one', '2030-01-11', '08:00');
    await sync.flush();

    let items = store.getSnapshot().document.items;

    expect(items[upcoming]?.calendarEventId).toBeNull();
    expect(items[past]?.calendarEventId).not.toBeNull();
    expect(items[created]).toMatchObject({ remind: true, calendarEventId: null });
    expect(calendar.calls.filter((call) => call.startsWith('create:New'))).toEqual([]);

    store.run((current, context) => updateSettings(current, { calendarForReminders: true }, context));
    await sync.flush();
    items = store.getSnapshot().document.items;

    expect(items[upcoming]?.calendarEventId).not.toBeNull();
    expect(items[created]?.calendarEventId).not.toBeNull();
  });
});

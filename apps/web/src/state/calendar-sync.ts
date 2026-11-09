import { updateItem } from '@notebook/core';
import type { IsoDate, Item, NotebookDocument } from '@notebook/core';
import { safeStorage } from '../platform/safe-storage';
import { AuthRequiredError } from '../ports';
import type { CalendarEvent, CalendarGateway, NewCalendarEvent } from '../ports';
import type { ChangeSource, NotebookStore } from './notebook-store';

const PENDING_KEY = 'notebook.calendar.pending';
const PUSHED_KEY = 'notebook.calendar.pushed';
const CHANGES_SINCE_KEY = 'notebook.calendar.changesSince';
/** How far back the first check looks, and the overlap kept between checks so an edit landing mid-request isn't missed. */
const FIRST_LOOKBACK_MS = 7 * 24 * 60 * 60_000;
const OVERLAP_MS = 60_000;

/** The calendar event an item should have: only items marked "Calendar + reminder" with a day get one. */
export const eventForItem = (item: Item): NewCalendarEvent | null => {
  if (item.deleted || !item.remind || item.day === null || item.text.trim() === '') {
    return null;
  }

  return { title: item.text, day: item.day, start: item.time, end: null, remindMinutesBefore: 0, notebookItemId: item.id };
};

const signature = (event: NewCalendarEvent): string => JSON.stringify([event.title, event.day, event.start]);

const readJson = <T>(key: string, fallback: T, guard: (value: unknown) => value is T): T => {
  const raw = safeStorage.get(key);

  if (raw === null) {
    return fallback;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    return guard(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((entry) => typeof entry === 'string');
const isStringRecord = (value: unknown): value is Record<string, string> => typeof value === 'object' && value !== null && !Array.isArray(value) && Object.values(value).every((entry) => typeof entry === 'string');

export type CalendarSyncState = { kind: 'idle' } | { kind: 'pending'; count: number } | { kind: 'needs-auth' } | { kind: 'error'; message: string };

/**
 * Keeps "Calendar + reminder" items and their Google Calendar events in step, both ways:
 * local edits push to the event, and edits made in the calendar flow back when that day is viewed.
 * Work is queued on the device so changes made offline or signed out are pushed later (ADR 0005).
 */
export class CalendarSync {
  private pending = new Set(readJson(PENDING_KEY, [] as string[], isStringArray));
  private pushed = new Map(Object.entries(readJson(PUSHED_KEY, {}, isStringRecord)));
  private running: Promise<void> | null = null;
  private rerun = false;
  private state: CalendarSyncState = { kind: 'idle' };
  private readonly listeners = new Set<() => void>();

  constructor(private readonly store: NotebookStore, private gateway: CalendarGateway | null) {
    store.onChange((before, after, source) => this.onDocumentChange(before, after, source));
  }

  setGateway(gateway: CalendarGateway | null): void {
    this.gateway = gateway;

    if (gateway) {
      void this.flush();
    }
  }

  getState = (): CalendarSyncState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);

    return () => this.listeners.delete(listener);
  };

  /** Pushes queued item changes to the calendar. Safe to call often. */
  async flush(): Promise<void> {
    if (this.running) {
      this.rerun = true;

      return this.running;
    }

    this.running = (async () => {
      do {
        this.rerun = false;
        await this.flushQueue();
      } while (this.rerun && this.gateway && this.pending.size > 0);
    })().finally(() => {
      this.running = null;
    });

    return this.running;
  }

  /**
   * Applies calendar-side edits to linked items after a day's events were fetched: an event that
   * moved (even to another day) or was renamed updates its item when the calendar edit is newer,
   * and an event that no longer exists turns the item's reminder off.
   */
  async reconcileDay(day: IsoDate, events: ReadonlyArray<CalendarEvent>): Promise<void> {
    const gateway = this.gateway;
    const document = this.store.getSnapshot().document;
    const byItem = new Map(events.filter((event) => event.notebookItemId !== null).map((event) => [event.notebookItemId, event]));
    const linked = Object.values(document.items).filter((item) => !item.deleted && item.calendarEventId !== null && !this.pending.has(item.id) && (item.day === day || byItem.has(item.id)));

    for (const item of linked) {
      const listed = byItem.get(item.id);
      const event = listed ?? (gateway && item.calendarEventId ? await gateway.get(item.calendarEventId).catch(() => undefined) : undefined);

      // Unknown (no gateway, offline, or lookup failed): leave the link alone and try again next time.
      if (event === undefined) {
        continue;
      }

      if (event === null) {
        this.pushed.delete(item.id);
        this.store.run((current, context) => updateItem(current, item.id, { remind: false, calendarEventId: null }, context));

        continue;
      }

      this.applyCalendarEdit(item, event);
    }

    this.persist();
  }

  /**
   * Applies calendar-side edits to linked items on any day, not only the day on screen: asks the
   * calendar what changed since the last check (device-local cursor) and runs each linked event
   * through the same rules as reconcileDay. Called on every sync tick and when the app comes back.
   */
  async reconcileChanges(now: Date = new Date()): Promise<void> {
    const gateway = this.gateway;

    if (!gateway) {
      return;
    }

    const since = safeStorage.get(CHANGES_SINCE_KEY) ?? new Date(now.getTime() - FIRST_LOOKBACK_MS).toISOString();
    const nextSince = new Date(now.getTime() - OVERLAP_MS).toISOString();
    const changes = await gateway.listChanged(since);
    const linked = (eventId: string): Item | undefined => Object.values(this.store.getSnapshot().document.items).find((item) => !item.deleted && item.calendarEventId === eventId && !this.pending.has(item.id));

    for (const event of changes.events) {
      const item = linked(event.id);

      if (item) {
        this.applyCalendarEdit(item, event);
      }
    }

    for (const eventId of changes.deletedIds) {
      const item = linked(eventId);

      if (item) {
        this.pushed.delete(item.id);
        this.store.run((current, context) => updateItem(current, item.id, { remind: false, calendarEventId: null }, context));
      }
    }

    safeStorage.set(CHANGES_SINCE_KEY, nextSince);
    this.persist();
  }

  /** Calendar edits win only when they are newer than the item, so a stale event never overwrites a newer edit. */
  private applyCalendarEdit(item: Item, event: CalendarEvent): void {
    const title = event.title === '(No title)' ? item.text : event.title;
    const changed = event.day !== item.day || event.start !== item.time || title !== item.text;

    if (!changed || event.updated <= item.updatedAt) {
      return;
    }

    this.pushed.set(item.id, signature({ title, day: event.day, start: event.start, end: null, remindMinutesBefore: 0, notebookItemId: item.id }));
    this.store.run((current, context) => updateItem(current, item.id, { day: event.day, time: event.start, text: title }, context));
  }

  private onDocumentChange(before: NotebookDocument, after: NotebookDocument, source: ChangeSource): void {
    if (source !== 'local') {
      return;
    }

    for (const [id, item] of Object.entries(after.items)) {
      if (before.items[id] === item) {
        continue;
      }

      const wanted = eventForItem(item);
      const needsPush = wanted ? item.calendarEventId === null || this.pushed.get(id) !== signature(wanted) : item.calendarEventId !== null;

      if (needsPush) {
        this.pending.add(id);
      }
    }

    this.persist();

    if (this.pending.size > 0) {
      this.setState({ kind: 'pending', count: this.pending.size });
      void this.flush();
    }
  }

  private async flushQueue(): Promise<void> {
    const gateway = this.gateway;

    if (!gateway) {
      return;
    }

    for (const id of [...this.pending]) {
      const item = this.store.getSnapshot().document.items[id];

      try {
        await this.pushItem(gateway, id, item);
        this.pending.delete(id);
        this.persist();
      } catch (error) {
        this.setState(error instanceof AuthRequiredError ? { kind: 'needs-auth' } : { kind: 'error', message: error instanceof Error ? error.message : 'Calendar update failed.' });

        return;
      }
    }

    this.setState({ kind: 'idle' });
  }

  private async pushItem(gateway: CalendarGateway, id: string, item: Item | undefined): Promise<void> {
    const wanted = item ? eventForItem(item) : null;
    const eventId = item?.calendarEventId ?? null;

    if (!wanted) {
      if (eventId) {
        await gateway.remove(eventId);
        this.pushed.delete(id);

        if (item && !item.deleted) {
          this.store.run((current, context) => updateItem(current, id, { calendarEventId: null }, context));
        }
      }

      return;
    }

    if (eventId && this.pushed.get(id) === signature(wanted)) {
      return;
    }

    const event = eventId ? await gateway.update(eventId, wanted) : await gateway.create(wanted);
    this.pushed.set(id, signature(wanted));

    if (event.id !== eventId) {
      this.store.run((current, context) => updateItem(current, id, { calendarEventId: event.id }, context));
    }
  }

  private persist(): void {
    safeStorage.set(PENDING_KEY, JSON.stringify([...this.pending]));
    safeStorage.set(PUSHED_KEY, JSON.stringify(Object.fromEntries(this.pushed)));
  }

  private setState(state: CalendarSyncState): void {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
}

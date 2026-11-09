import type { NotebookDocument } from '@notebook/core';
import { ConflictError } from '../ports';
import type { CalendarChanges, CalendarEvent, CalendarGateway, CalendarInfo, LocalDocumentStore, NewCalendarEvent, RemoteDocumentStore, StoredDocument } from '../ports';

export const memoryLocalStore = (): LocalDocumentStore & { saved: NotebookDocument | null } => {
  const state = { saved: null as NotebookDocument | null };

  return {
    get saved() {
      return state.saved;
    },
    load: () => state.saved,
    save: (document) => {
      state.saved = document;
    },
    clear: () => {
      state.saved = null;
    },
  };
};

/** In-memory remote with a version counter, mirroring Drive's optimistic concurrency. */
export class MemoryRemoteStore implements RemoteDocumentStore {
  stored: StoredDocument | null = null;
  saves = 0;
  failNext: Error | null = null;
  /** Simulates another device writing between our load and save. */
  interleave: (() => void) | null = null;

  async load(): Promise<StoredDocument | null> {
    if (this.failNext) {
      const error = this.failNext;
      this.failNext = null;

      throw error;
    }

    this.loads += 1;
    const snapshot = this.stored;
    const interleave = this.interleave;
    this.interleave = null;
    interleave?.();

    return snapshot;
  }

  loads = 0;

  async version(): Promise<string | null> {
    return this.stored?.version ?? null;
  }

  async save(document: NotebookDocument, expectedVersion: string | null): Promise<StoredDocument> {
    if ((this.stored?.version ?? null) !== expectedVersion) {
      throw new ConflictError();
    }

    this.saves += 1;
    this.stored = { document: JSON.parse(JSON.stringify(document)) as NotebookDocument, version: String(Number(this.stored?.version ?? '0') + 1) };

    return this.stored;
  }

  /** Writes as if from another device. */
  writeExternally(document: NotebookDocument): void {
    this.stored = { document, version: String(Number(this.stored?.version ?? '0') + 1) };
  }
}

export class FakeCalendar implements CalendarGateway {
  events = new Map<string, CalendarEvent>();
  calls: string[] = [];
  private counter = 0;
  private clock = 0;

  async listCalendars(): Promise<CalendarInfo[]> {
    return [{ id: 'primary', name: 'Me', primary: true }];
  }

  async listDay(day: string): Promise<CalendarEvent[]> {
    return [...this.events.values()].filter((event) => event.day === day);
  }

  async get(eventId: string): Promise<CalendarEvent | null> {
    return this.events.get(eventId) ?? null;
  }

  async listChanged(since: string): Promise<CalendarChanges> {
    this.calls.push(`listChanged:${since}`);

    return { events: [...this.events.values()].filter((event) => event.updated >= since), deletedIds: [...this.deletedIds] };
  }

  deletedIds: string[] = [];

  /** Simulates deleting the event in Google or iPhone Calendar. */
  deleteExternally(eventId: string): void {
    this.events.delete(eventId);
    this.deletedIds.push(eventId);
  }

  /** Simulates an edit made in Google or iPhone Calendar. */
  editExternally(eventId: string, patch: Partial<CalendarEvent>): void {
    const event = this.events.get(eventId);

    if (event) {
      this.clock += 1;
      this.events.set(eventId, { ...event, ...patch, updated: new Date(Date.UTC(2030, 0, 1, 0, 0, this.clock)).toISOString() });
    }
  }

  async create(event: NewCalendarEvent): Promise<CalendarEvent> {
    this.counter += 1;
    const created = this.toEvent(`ev-${this.counter}`, event);
    this.events.set(created.id, created);
    this.calls.push(`create:${event.title}`);

    return created;
  }

  async update(eventId: string, event: NewCalendarEvent): Promise<CalendarEvent> {
    const updated = this.toEvent(eventId, event);
    this.events.set(eventId, updated);
    this.calls.push(`update:${event.title}`);

    return updated;
  }

  async remove(eventId: string): Promise<void> {
    this.events.delete(eventId);
    this.calls.push(`remove:${eventId}`);
  }

  private toEvent(id: string, event: NewCalendarEvent): CalendarEvent {
    return { id, calendarId: 'primary', calendarName: null, title: event.title, day: event.day, start: event.start, end: event.end, allDay: event.start === null, notebookItemId: event.notebookItemId, htmlLink: null, editable: true, updated: new Date(0).toISOString() };
  }
}

export const sequentialIds = (): (() => string) => {
  const state = { next: 0 };

  return () => {
    state.next += 1;

    return `t-${state.next}`;
  };
};

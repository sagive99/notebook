import type { NotebookDocument } from '@notebook/core';
import { ConflictError } from '../ports';
import type { CalendarEvent, CalendarGateway, LocalDocumentStore, NewCalendarEvent, RemoteDocumentStore, StoredDocument } from '../ports';

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

    const snapshot = this.stored;
    const interleave = this.interleave;
    this.interleave = null;
    interleave?.();

    return snapshot;
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

  async listDay(day: string): Promise<CalendarEvent[]> {
    return [...this.events.values()].filter((event) => event.day === day);
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
    return { id, calendarId: 'primary', title: event.title, day: event.day, start: event.start, end: event.end, allDay: event.start === null, notebookItemId: event.notebookItemId, htmlLink: null, editable: true };
  }
}

export const sequentialIds = (): (() => string) => {
  const state = { next: 0 };

  return () => {
    state.next += 1;

    return `t-${state.next}`;
  };
};

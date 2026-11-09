import type { IsoDate, NotebookDocument } from '@notebook/core';

/** A stored copy of the notebook plus an opaque version used to detect concurrent writers. */
export type StoredDocument = {
  document: NotebookDocument;
  version: string;
};

/** Remote storage of the whole notebook document (Google Drive app data in production). */
export type RemoteDocumentStore = {
  /** Returns null when no notebook has been stored yet. */
  load: () => Promise<StoredDocument | null>;
  /** The stored version without downloading the document; null when nothing is stored yet. */
  version: () => Promise<string | null>;
  /** Writes the document; rejects with ConflictError when the stored version is no longer `expectedVersion`. */
  save: (document: NotebookDocument, expectedVersion: string | null) => Promise<StoredDocument>;
};

/** Device-local cache, also the only store in local-only mode. */
export type LocalDocumentStore = {
  load: () => NotebookDocument | null;
  save: (document: NotebookDocument) => void;
  clear: () => void;
};

export type CalendarEvent = {
  id: string;
  calendarId: string;
  calendarName: string | null;
  title: string;
  day: IsoDate;
  /** Null for all-day events. */
  start: string | null;
  end: string | null;
  allDay: boolean;
  /** Set on events created from a notebook item. */
  notebookItemId: string | null;
  htmlLink: string | null;
  editable: boolean;
  /** When the event last changed in the calendar (ISO timestamp). */
  updated: string;
};

export type NewCalendarEvent = {
  title: string;
  day: IsoDate;
  start: string | null;
  end: string | null;
  /** A popup alert this many minutes before; null leaves the calendar's own reminder settings untouched. */
  remindMinutesBefore: number | null;
  notebookItemId: string | null;
};

export type CalendarChanges = { events: CalendarEvent[]; deletedIds: string[] };

export type CalendarInfo = {
  id: string;
  name: string;
  primary: boolean;
};

export type CalendarGateway = {
  listCalendars: () => Promise<CalendarInfo[]>;
  listDay: (day: IsoDate, calendarIds?: ReadonlyArray<string>) => Promise<CalendarEvent[]>;
  /** Events in the main calendar changed at or after `since` (ISO), with the ids of ones deleted since then. */
  listChanged: (since: string) => Promise<CalendarChanges>;
  /** One event by id, or null when it was deleted or cancelled. */
  get: (eventId: string) => Promise<CalendarEvent | null>;
  create: (event: NewCalendarEvent) => Promise<CalendarEvent>;
  update: (eventId: string, event: NewCalendarEvent, calendarId?: string) => Promise<CalendarEvent>;
  remove: (eventId: string, calendarId?: string) => Promise<void>;
};

export type StarredEmail = {
  id: string;
  subject: string;
  from: string;
  link: string;
};

export type AuthState = { status: 'signed-out' } | { status: 'expired' } | { status: 'signed-in' };

/** What the app needs to know about the Google session, independent of the sign-in library. */
export type AuthPort = {
  state: () => AuthState;
  subscribe: (listener: () => void) => () => void;
};

export type MailGateway = {
  listStarred: (limit: number) => Promise<StarredEmail[]>;
};

export class OfflineError extends Error {
  constructor() {
    super('No connection. Changes are saved on this device and will sync later.');
    this.name = 'OfflineError';
  }
}

export class ConflictError extends Error {
  constructor() {
    super('The stored notebook changed since it was last read.');
    this.name = 'ConflictError';
  }
}

export class AuthRequiredError extends Error {
  constructor(message = 'Google sign-in is required.') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

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

export type CalendarGateway = {
  listDay: (day: IsoDate) => Promise<CalendarEvent[]>;
  create: (event: NewCalendarEvent) => Promise<CalendarEvent>;
  update: (eventId: string, event: NewCalendarEvent) => Promise<CalendarEvent>;
  remove: (eventId: string) => Promise<void>;
};

export type StarredEmail = {
  id: string;
  subject: string;
  from: string;
  link: string;
};

export type MailGateway = {
  listStarred: (limit: number) => Promise<StarredEmail[]>;
};

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

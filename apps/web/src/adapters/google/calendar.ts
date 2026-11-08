import { addDays, atClockTime, toClockTime, toIsoDate } from '@notebook/core';
import type { IsoDate } from '@notebook/core';
import { z } from 'zod';
import type { CalendarEvent, CalendarGateway, NewCalendarEvent } from '../../ports';
import { SCOPES } from './auth';
import type { GoogleAuth } from './auth';
import { GoogleApiError, googleFetch } from './http';

const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const DEFAULT_DURATION_MINUTES = 30;
const ITEM_PROPERTY = 'notebookItemId';

const eventSchema = z.object({
  id: z.string().min(1),
  status: z.string().optional(),
  summary: z.string().optional(),
  htmlLink: z.string().regex(/^https:\/\/[^\s]+$/u).optional(),
  updated: z.string().optional(),
  start: z.object({ date: z.string().optional(), dateTime: z.string().optional() }),
  end: z.object({ date: z.string().optional(), dateTime: z.string().optional() }).optional(),
  extendedProperties: z.object({ private: z.record(z.string(), z.string()).optional() }).optional(),
  guestsCanModify: z.boolean().optional(),
  organizer: z.object({ self: z.boolean().optional() }).optional(),
});

const listSchema = z.object({ items: z.array(eventSchema).default([]), nextPageToken: z.string().optional() });

type GoogleEvent = z.infer<typeof eventSchema>;

const toCalendarEvent = (event: GoogleEvent): CalendarEvent => {
  const allDay = event.start.dateTime === undefined;
  const start = event.start.dateTime ? new Date(event.start.dateTime) : null;
  const end = event.end?.dateTime ? new Date(event.end.dateTime) : null;

  return {
    id: event.id,
    calendarId: 'primary',
    title: event.summary?.trim() || '(No title)',
    day: start ? toIsoDate(start) : event.start.date ?? '',
    start: start ? toClockTime(start) : null,
    end: end ? toClockTime(end) : null,
    allDay,
    notebookItemId: event.extendedProperties?.private?.[ITEM_PROPERTY] ?? null,
    htmlLink: event.htmlLink ?? null,
    editable: event.organizer?.self !== false,
    updated: event.updated ?? new Date(0).toISOString(),
  };
};

const toGoogleEvent = (event: NewCalendarEvent): Record<string, unknown> => {
  const timing = event.start === null
    ? { start: { date: event.day }, end: { date: addDays(event.day, 1) } }
    : (() => {
        const start = atClockTime(event.day, event.start);
        const end = event.end ? atClockTime(event.day, event.end) : new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60_000);
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        return { start: { dateTime: start.toISOString(), timeZone }, end: { dateTime: (end > start ? end : new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60_000)).toISOString(), timeZone } };
      })();
  const reminders = event.remindMinutesBefore === null ? null : { useDefault: false, overrides: [{ method: 'popup', minutes: event.remindMinutesBefore }] };
  const extendedProperties = event.notebookItemId ? { private: { [ITEM_PROPERTY]: event.notebookItemId } } : null;

  return { summary: event.title, ...timing, ...(reminders ? { reminders } : {}), ...(extendedProperties ? { extendedProperties } : {}) };
};

/** Two-way access to the user's primary Google Calendar, which iPhone Calendar mirrors when the account is added in iOS Settings. */
export class GoogleCalendarGateway implements CalendarGateway {
  constructor(private readonly auth: GoogleAuth) {}

  async listDay(day: IsoDate): Promise<CalendarEvent[]> {
    const timeMin = atClockTime(day, '00:00').toISOString();
    const timeMax = atClockTime(addDays(day, 1), '00:00').toISOString();
    const query = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '100' });
    const response = await googleFetch(this.auth, SCOPES.calendar, `${API}?${query.toString()}`);
    const listing = listSchema.parse(await response.json());

    return listing.items.filter((event) => event.status !== 'cancelled').map(toCalendarEvent);
  }

  async get(eventId: string): Promise<CalendarEvent | null> {
    const response = await googleFetch(this.auth, SCOPES.calendar, `${API}/${encodeURIComponent(eventId)}`).catch((error: unknown) => {
      if (error instanceof GoogleApiError && (error.status === 404 || error.status === 410)) {
        return null;
      }

      throw error;
    });

    if (!response) {
      return null;
    }

    const event = eventSchema.parse(await response.json());

    return event.status === 'cancelled' ? null : toCalendarEvent(event);
  }

  async create(event: NewCalendarEvent): Promise<CalendarEvent> {
    const response = await googleFetch(this.auth, SCOPES.calendar, API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(toGoogleEvent(event)) });

    return toCalendarEvent(eventSchema.parse(await response.json()));
  }

  async update(eventId: string, event: NewCalendarEvent): Promise<CalendarEvent> {
    const response = await googleFetch(this.auth, SCOPES.calendar, `${API}/${encodeURIComponent(eventId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(toGoogleEvent(event)) });

    return toCalendarEvent(eventSchema.parse(await response.json()));
  }

  async remove(eventId: string): Promise<void> {
    await googleFetch(this.auth, SCOPES.calendar, `${API}/${encodeURIComponent(eventId)}`, { method: 'DELETE' }).catch((error: unknown) => {
      // Already deleted in Google Calendar: the goal is reached.
      if (error instanceof GoogleApiError && (error.status === 404 || error.status === 410)) {
        return;
      }

      throw error;
    });
  }
}

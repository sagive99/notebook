import { addDays, atClockTime, toClockTime, toIsoDate } from '@notebook/core';
import type { IsoDate } from '@notebook/core';
import { z } from 'zod';
import type { CalendarEvent, CalendarGateway, CalendarInfo, NewCalendarEvent } from '../../ports';
import { SCOPES } from './auth';
import type { GoogleAuth } from './auth';
import { API, DEFAULT_DURATION_MINUTES, ITEM_PROPERTY, PRIMARY, WRITABLE_ROLES } from './calendar.consts';
import { GoogleApiError, googleFetch } from './http';

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

const listSchema = z.object({ summary: z.string().optional(), accessRole: z.string().optional(), items: z.array(eventSchema).default([]) });

const calendarListSchema = z.object({
  items: z.array(z.object({ id: z.string().min(1), summary: z.string().optional(), summaryOverride: z.string().optional(), primary: z.boolean().optional() })).default([]),
});

type GoogleEvent = z.infer<typeof eventSchema>;

const eventsUrl = (calendarId: string, eventId?: string): string => `${API}/calendars/${encodeURIComponent(calendarId)}/events${eventId ? `/${encodeURIComponent(eventId)}` : ''}`;

const isGone = (error: unknown): boolean => error instanceof GoogleApiError && (error.status === 404 || error.status === 410);

const toCalendarEvent = (event: GoogleEvent, calendarId = PRIMARY, calendarName: string | null = null, writable = true): CalendarEvent => {
  const allDay = event.start.dateTime === undefined;
  const start = event.start.dateTime ? new Date(event.start.dateTime) : null;
  const end = event.end?.dateTime ? new Date(event.end.dateTime) : null;

  return {
    id: event.id,
    calendarId,
    calendarName,
    title: event.summary?.trim() || '(No title)',
    day: start ? toIsoDate(start) : event.start.date ?? '',
    start: start ? toClockTime(start) : null,
    end: end ? toClockTime(end) : null,
    allDay,
    notebookItemId: event.extendedProperties?.private?.[ITEM_PROPERTY] ?? null,
    htmlLink: event.htmlLink ?? null,
    editable: writable && event.organizer?.self !== false,
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

/** Reads the calendars the user picked and writes to primary; iPhone Calendar mirrors them when the account is added in iOS Settings. */
export class GoogleCalendarGateway implements CalendarGateway {
  constructor(private readonly auth: GoogleAuth) {}

  async listCalendars(): Promise<CalendarInfo[]> {
    const response = await googleFetch(this.auth, SCOPES.calendarList, `${API}/users/me/calendarList`);

    return calendarListSchema.parse(await response.json()).items.map((entry) => ({
      id: entry.primary ? PRIMARY : entry.id,
      name: entry.summaryOverride ?? entry.summary ?? entry.id,
      primary: entry.primary ?? false,
    }));
  }

  async listDay(day: IsoDate, calendarIds: ReadonlyArray<string> = [PRIMARY]): Promise<CalendarEvent[]> {
    const timeMin = atClockTime(day, '00:00').toISOString();
    const timeMax = atClockTime(addDays(day, 1), '00:00').toISOString();
    const query = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '100' });
    const listOne = async (calendarId: string): Promise<CalendarEvent[]> => {
      const response = await googleFetch(this.auth, SCOPES.calendar, `${eventsUrl(calendarId)}?${query.toString()}`);
      const listing = listSchema.parse(await response.json());
      const writable = WRITABLE_ROLES.includes(listing.accessRole ?? 'owner');
      const name = calendarId === PRIMARY ? null : listing.summary ?? null;

      return listing.items.filter((event) => event.status !== 'cancelled').map((event) => toCalendarEvent(event, calendarId, name, writable));
    };
    const lists = await Promise.all(calendarIds.map((calendarId) => (calendarId === PRIMARY ? listOne(calendarId) : listOne(calendarId).catch((error: unknown) => {
      if (isGone(error) || (error instanceof GoogleApiError && error.status === 403)) {
        return [];
      }

      throw error;
    }))));

    return lists.flat().sort((a, b) => Number(b.allDay) - Number(a.allDay) || (a.start ?? '').localeCompare(b.start ?? ''));
  }

  async get(eventId: string): Promise<CalendarEvent | null> {
    const response = await googleFetch(this.auth, SCOPES.calendar, eventsUrl(PRIMARY, eventId)).catch((error: unknown) => {
      if (isGone(error)) {
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
    const response = await googleFetch(this.auth, SCOPES.calendar, eventsUrl(PRIMARY), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(toGoogleEvent(event)) });

    return toCalendarEvent(eventSchema.parse(await response.json()));
  }

  async update(eventId: string, event: NewCalendarEvent, calendarId = PRIMARY): Promise<CalendarEvent> {
    const response = await googleFetch(this.auth, SCOPES.calendar, eventsUrl(calendarId, eventId), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(toGoogleEvent(event)) });

    return toCalendarEvent(eventSchema.parse(await response.json()), calendarId);
  }

  async remove(eventId: string, calendarId = PRIMARY): Promise<void> {
    await googleFetch(this.auth, SCOPES.calendar, eventsUrl(calendarId, eventId), { method: 'DELETE' }).catch((error: unknown) => {
      // Already deleted in Google Calendar: the goal is reached.
      if (isGone(error)) {
        return;
      }

      throw error;
    });
  }
}

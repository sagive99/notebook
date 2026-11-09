import { afterEach, expect, it, vi } from 'vitest';
import type { GoogleAuth } from './auth';
import { GoogleCalendarGateway } from './calendar';

const auth = { accessToken: () => 'token', hasScope: () => true, invalidate: () => undefined } as unknown as GoogleAuth;

afterEach(() => vi.unstubAllGlobals());

it('merges selected calendars, sorts by time, and skips a calendar that is gone', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/calendars/primary/')) {
      return Response.json({ summary: 'me@example.com', accessRole: 'owner', items: [{ id: 'a', summary: 'Standup', start: { dateTime: '2026-11-09T10:00:00' }, end: { dateTime: '2026-11-09T10:15:00' } }] });
    }

    if (url.includes('/calendars/zapp/')) {
      return Response.json({ summary: 'Zapp', accessRole: 'reader', items: [{ id: 'b', summary: 'Release', start: { dateTime: '2026-11-09T09:00:00' } }, { id: 'c', summary: 'Holiday', start: { date: '2026-11-09' } }] });
    }

    return Response.json({ error: { message: 'Not Found' } }, { status: 404 });
  }));

  const events = await new GoogleCalendarGateway(auth).listDay('2026-11-09', ['primary', 'zapp', 'removed']);

  expect(events.map((event) => [event.title, event.calendarId, event.calendarName, event.editable])).toEqual([
    ['Holiday', 'zapp', 'Zapp', false],
    ['Release', 'zapp', 'Zapp', false],
    ['Standup', 'primary', null, true],
  ]);
});

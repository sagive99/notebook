import { isWorkItem } from '@notebook/core';
import type { IsoDate } from '@notebook/core';
import { useState } from 'preact/hooks';
import { useDayEvents, useNotebook, useServices } from '../../state/hooks';
import { Card, Empty } from '../components/primitives';
import { BellIcon } from '../icons';
import { useSheets } from '../sheets/sheet-context';

export const ScheduleBlock = ({ day, hideWork = false }: { day: IsoDate; hideWork?: boolean }) => {
  const { calendar, workCalendars } = useServices();
  const { document } = useNotebook();
  const [workIds] = useState(workCalendars);
  const { state, reload } = useDayEvents(day);
  const sheets = useSheets();
  const loaded = state.kind === 'ready' ? state.data : state.kind === 'loading' || state.kind === 'error' ? state.previous ?? [] : [];
  // With Work off: drop events from work calendars and reminders that belong to work items.
  const isWorkEvent = (event: (typeof loaded)[number]): boolean => {
    const item = event.notebookItemId ? document.items[event.notebookItemId] : undefined;

    return workIds.includes(event.calendarId) || Boolean(item && isWorkItem(document, item));
  };
  const events = hideWork ? loaded.filter((event) => !isWorkEvent(event)) : loaded;
  const hiddenCount = loaded.length - events.length;

  return (
    <Card>
      <div class="card__head">
        <h2 class="card__title">Schedule</h2>
        {calendar && state.kind !== 'needs-auth' && state.kind !== 'unavailable' ? (
          <button type="button" class="soft-button" onClick={() => sheets.open({ kind: 'event', day, onSaved: reload })}>+ Event</button>
        ) : <span class="card__meta">Google Calendar</span>}
      </div>
      {!calendar ? <Empty>Calendar sync turns on once the app has a Google client ID (see the setup guide).</Empty> : null}
      {calendar && state.kind === 'unavailable' ? <Empty>Connect Google to see this day’s calendar.</Empty> : null}
      {state.kind === 'needs-auth' ? <Empty>Reconnect Google to load your calendar.</Empty> : null}
      {state.kind === 'error' ? <p class="inline-error" role="alert">{state.message} <button type="button" class="link-button" onClick={reload}>Retry</button></p> : null}
      {state.kind === 'loading' && events.length === 0 ? <p class="card__meta">Loading…</p> : null}
      {state.kind === 'ready' && events.length === 0 ? <Empty>{hiddenCount > 0 ? 'Nothing besides work on the calendar.' : 'Nothing on the calendar.'}</Empty> : null}
      <ul class="event-list">
        {events.map((event) => (
          <li key={`${event.calendarId}:${event.id}`}>
            <button type="button" class="event" onClick={() => sheets.open({ kind: 'event', day, event, onSaved: reload })}>
              <span class="event__bar" aria-hidden="true" />
              <span class="event__body">
                <span class="event__title" dir="auto">{event.title}</span>
                <span class="event__time">{event.allDay ? 'All day' : `${event.start ?? ''}${event.end ? ` – ${event.end}` : ''}`}{event.calendarName ? ` · ${event.calendarName}` : null}{event.notebookItemId ? <> · <BellIcon size={11} /> from notebook</> : null}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
};

import type { IsoDate } from '@notebook/core';
import { useState } from 'preact/hooks';
import { useServices } from '../../state/hooks';
import type { CalendarEvent } from '../../ports';
import { SectionLabel, Sheet, SheetHeader, Toggle } from '../components/primitives';
import { ExternalIcon } from '../icons';

/** Creates or edits a Google Calendar event directly; the change shows up on the iPhone calendar too. */
export const EventSheet = ({ day, event, onSaved, onClose }: { day: IsoDate; event?: CalendarEvent; onSaved?: () => void; onClose: () => void }) => {
  const { calendar } = useServices();
  const [title, setTitle] = useState(event?.title ?? '');
  const [date, setDate] = useState(event?.day ?? day);
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [start, setStart] = useState(event?.start ?? '09:00');
  const [end, setEnd] = useState(event?.end ?? '09:30');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const readOnly = Boolean(event && !event.editable);
  const fromNotebook = Boolean(event?.notebookItemId);

  const perform = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);

    try {
      await action();
      onSaved?.();
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Calendar update failed.');
      setBusy(false);
    }
  };

  const save = () => {
    if (!calendar || title.trim() === '' || readOnly) {
      return;
    }

    const payload = { title: title.trim(), day: date, start: allDay ? null : start, end: allDay ? null : end, remindMinutesBefore: fromNotebook ? 0 : null, notebookItemId: event?.notebookItemId ?? null };
    void perform(() => (event ? calendar.update(event.id, payload, event.calendarId) : calendar.create(payload)));
  };

  return (
    <Sheet label={event ? 'Calendar event' : 'New calendar event'} onClose={onClose}>
      <SheetHeader title={event ? 'Event' : 'New event'} onCancel={onClose} action={readOnly ? undefined : { label: busy ? 'Saving…' : 'Save', onClick: save, disabled: busy || title.trim() === '' || !calendar }} />
      <form class="form" onSubmit={(formEvent) => {
        formEvent.preventDefault();
        save();
      }}>
        <label class="field">
          <SectionLabel>Title</SectionLabel>
          <input class="text-input text-input--large" dir="auto" value={title} disabled={readOnly} onInput={(inputEvent) => setTitle(inputEvent.currentTarget.value)} />
        </label>
        <div class="settings-list">
          <label class="settings-row"><span class="settings-row__label">Day</span><input class="date-input" type="date" value={date} disabled={readOnly} onInput={(inputEvent) => setDate(inputEvent.currentTarget.value || day)} /></label>
          <div class="settings-row"><span class="settings-row__label">All day</span><Toggle label="All day" checked={allDay} onChange={(value) => !readOnly && setAllDay(value)} /></div>
          {allDay ? null : (
            <>
              <label class="settings-row"><span class="settings-row__label">Starts</span><input class="time-input" type="time" value={start} disabled={readOnly} onInput={(inputEvent) => setStart(inputEvent.currentTarget.value || '09:00')} /></label>
              <label class="settings-row"><span class="settings-row__label">Ends</span><input class="time-input" type="time" value={end} disabled={readOnly} onInput={(inputEvent) => setEnd(inputEvent.currentTarget.value || start)} /></label>
            </>
          )}
        </div>
        {fromNotebook ? <p class="hint">This event belongs to a notebook item. Changes made here also update the item.</p> : null}
        {readOnly ? <p class="hint">You are a guest on this event, so it can only be changed by its organizer.</p> : null}
        {error ? <p class="inline-error" role="alert">{error}</p> : null}
        {event?.htmlLink ? <a class="link-button" href={event.htmlLink} target="_blank" rel="noopener noreferrer">Open in Google Calendar <ExternalIcon size={14} /></a> : null}
        {event && !readOnly && calendar ? (
          <div class="danger-zone">
            {confirmDelete ? (
              <>
                <span>Delete this event from your calendar?</span>
                <button type="button" class="danger-button" disabled={busy} onClick={() => void perform(() => calendar.remove(event.id, event.calendarId))}>Delete</button>
                <button type="button" class="link-button" onClick={() => setConfirmDelete(false)}>Keep</button>
              </>
            ) : <button type="button" class="link-button link-button--danger" onClick={() => setConfirmDelete(true)}>Delete event</button>}
          </div>
        ) : null}
      </form>
    </Sheet>
  );
};

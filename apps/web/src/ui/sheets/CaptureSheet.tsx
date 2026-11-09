import { addDays, addItem, defaultCaptureTarget, liveSpaces, livePeople, parseCapture, toIsoDate } from '@notebook/core';
import type { IsoDate, ItemKind } from '@notebook/core';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useNotebook, useServices } from '../../state/hooks';
import { openShortcut, reminderHandoff } from '../../state/reminders-handoff';
import { Chip, SectionLabel, Sheet, SheetHeader, Toggle } from '../components/primitives';
import { relativeDay } from '../format';
import { BellIcon, PersonIcon } from '../icons';
import type { CapturePreset } from './sheet-context';

type Destination = { kind: 'day'; day: IsoDate } | { kind: 'space'; spaceId: string };

const KINDS: Array<{ kind: ItemKind; label: string }> = [{ kind: 'task', label: 'Task' }, { kind: 'note', label: 'Note' }, { kind: 'idea', label: 'Idea' }];

const initialDestination = (preset: CapturePreset, now: Date, cutoff: string): Destination => {
  if (preset.spaceId) {
    return { kind: 'space', spaceId: preset.spaceId };
  }

  if (preset.day) {
    return { kind: 'day', day: preset.day };
  }

  return { kind: 'day', day: defaultCaptureTarget(now, cutoff) === 'tomorrow' ? addDays(toIsoDate(now), 1) : toIsoDate(now) };
};

/** Quick capture: one text box first, structure second. Reads @person, #tag, "tomorrow" and times from the text. */
export const CaptureSheet = ({ preset = {}, onClose }: { preset?: CapturePreset; onClose: () => void }) => {
  const { document, run } = useNotebook();
  const { calendar } = useServices();
  const now = new Date();
  const today = toIsoDate(now);
  const [text, setText] = useState(preset.text ?? '');
  const [kind, setKind] = useState<ItemKind>(preset.kind ?? 'task');
  const [destination, setDestination] = useState<Destination>(() => initialDestination(preset, now, document.settings.eveningCutoff));
  const [personId, setPersonId] = useState<string | null>(preset.personId ?? null);
  const [remind, setRemind] = useState(false);
  const [remindTime, setRemindTime] = useState('08:30');
  const textRef = useRef<HTMLTextAreaElement>(null);
  const people = livePeople(document);
  const spaces = liveSpaces(document).filter((space) => space.inCapture);
  const parsed = parseCapture(text, people, now);
  const effectivePerson = parsed.personId ?? personId;
  const effectiveDay = destination.kind === 'day' ? parsed.day ?? destination.day : parsed.day;
  const effectiveTime = parsed.time ?? (remind ? remindTime : null);

  useEffect(() => {
    textRef.current?.focus();
  }, []);

  const save = () => {
    if (parsed.text === '') {
      return;
    }

    const spaceId = destination.kind === 'space' ? destination.spaceId : null;
    const space = spaceId ? document.spaces[spaceId] : undefined;
    const columnId = preset.columnId ?? (space?.layout === 'board' ? space.columns[0]?.id ?? null : null);

    let handoff: string | null = null;
    run((current, context) => {
      const added = addItem(current, {
      kind,
      text: parsed.text,
      day: effectiveDay ?? null,
      time: effectiveTime,
      remind: remind && effectiveDay !== null,
      spaceId,
      columnId,
      personId: effectivePerson,
      tags: parsed.tags,
      sourceEmailId: preset.sourceEmailId ?? null,
      }, context);
      handoff = reminderHandoff(added.item.id, added.item);

      return added.document;
    });
    onClose();
    openShortcut(handoff);
  };

  const dayChoices: IsoDate[] = [today, addDays(today, 1)];

  return (
    <Sheet label="New item" onClose={onClose}>
      <SheetHeader title="New" onCancel={onClose} action={{ label: 'Save', onClick: save, disabled: parsed.text === '' }} />
      <form class="form" onSubmit={(event) => {
        event.preventDefault();
        save();
      }}>
        <label class="field">
          <SectionLabel>What’s on your mind</SectionLabel>
          <textarea ref={textRef} class="capture-input" dir="auto" rows={3} value={text} placeholder="e.g. Ask @Omer about the deploy tomorrow 9:30" onInput={(event) => setText(event.currentTarget.value)} onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              save();
            }
          }} />
        </label>

        <div class="field">
          <SectionLabel>Type</SectionLabel>
          <div class="chip-row">{KINDS.map((option) => <Chip key={option.kind} selected={kind === option.kind} onClick={() => setKind(option.kind)}>{option.label}</Chip>)}</div>
        </div>

        <div class="field">
          <SectionLabel>Put it in</SectionLabel>
          <div class="chip-row chip-row--wrap">
            {dayChoices.map((day) => <Chip key={day} selected={destination.kind === 'day' && destination.day === day && parsed.day === null} onClick={() => setDestination({ kind: 'day', day })}>{day === today ? 'Today' : 'Tomorrow morning'}</Chip>)}
            {destination.kind === 'day' && !dayChoices.includes(destination.day) ? <Chip selected onClick={() => undefined}>{relativeDay(destination.day, today)}</Chip> : null}
            {spaces.map((space) => <Chip key={space.id} selected={destination.kind === 'space' && destination.spaceId === space.id} onClick={() => setDestination({ kind: 'space', spaceId: space.id })}>{space.name}</Chip>)}
          </div>
          {parsed.day ? <span class="hint">Day from your text: {relativeDay(parsed.day, today)}</span> : null}
        </div>

        <div class="settings-list">
          <label class="settings-row">
            <PersonIcon size={20} />
            <span class="settings-row__label">Person</span>
            <select class="select" value={effectivePerson ?? ''} disabled={parsed.personId !== null} onChange={(event) => setPersonId(event.currentTarget.value || null)}>
              <option value="">Nobody</option>
              {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
          </label>
          <div class="settings-row">
            <BellIcon size={20} />
            <span class="settings-row__label">Calendar + reminder</span>
            {remind && parsed.time === null ? <input class="time-input" type="time" aria-label="Reminder time" value={remindTime} onInput={(event) => setRemindTime(event.currentTarget.value || '08:30')} /> : null}
            {remind && parsed.time !== null ? <span class="card__meta">{parsed.time}</span> : null}
            <Toggle label="Calendar + reminder" checked={remind} onChange={setRemind} />
          </div>
        </div>
        {remind && effectiveDay === null ? <p class="hint">Pick a day for the reminder, or write one (“tomorrow 9:00”).</p> : null}
        {remind && !calendar ? <p class="hint">Saved now; it will reach your calendar once Google is set up.</p> : null}
        <p class="hint">Type <b>@name</b> for a person, <b>#tag</b> for a tag, and words like “tomorrow” or “14:30” to set the day and time. After {document.settings.eveningCutoff}, new items go to tomorrow morning by default.</p>
      </form>
    </Sheet>
  );
};

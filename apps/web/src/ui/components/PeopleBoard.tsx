import { moveTaskOnPeopleBoard, resolveLegacyNow, setItemOngoing, teamTasks, toIsoDate, toggleItemDone } from '@notebook/core';
import type { IsoDate, Item, PersonTasks } from '@notebook/core';
import { useMemo, useState } from 'preact/hooks';
import { useNotebook } from '../../state/hooks';
import { initials, personTone, relativeDay } from '../format';
import { CheckIcon, GripIcon, PauseIcon, PlayIcon } from '../icons';
import { useSheets } from '../sheets/sheet-context';
import { Empty } from './primitives';
import { useTaskDrag } from './useTaskDrag';
import type { DropTarget } from './useTaskDrag';

type Filter = 'everyone' | 'ongoing' | 'blocked';

const since = (iso: string | null, today: IsoDate): string => {
  if (iso === null) {
    return '';
  }

  const date = new Date(iso);
  const day = relativeDay(toIsoDate(date), today);

  return day === 'Today' ? `Ongoing since ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : `Ongoing since ${day === 'Yesterday' ? 'yesterday' : day}`;
};

const summary = ({ ongoing, next }: PersonTasks): string => {
  const active = ongoing.filter((item) => !item.done).length;
  const open = next.filter((item) => !item.done).length;

  if (active === 0 && open === 0) {
    return 'Nothing open';
  }

  return [active > 0 ? `${active} ongoing` : 'Nothing ongoing', open > 0 ? `${open} up next` : null].filter(Boolean).join(' · ');
};

/**
 * One card per person: ongoing tasks highlighted on top, then up next. Ticking a task shows ✓ and keeps it
 * in place until the user leaves this screen (the kept set lives in component state, so it resets on leave).
 */
export const PeopleBoard = ({ today, spaceId }: { today: IsoDate; spaceId: string | null }) => {
  const { document, run } = useNotebook();
  const sheets = useSheets();
  const [filter, setFilter] = useState<Filter>('everyone');
  const [keepDone, setKeepDone] = useState<ReadonlySet<string>>(() => new Set());
  const team = useMemo(() => teamTasks(document, keepDone), [document, keepDone]);
  const ongoingPeople = team.filter((entry) => entry.ongoing.some((item) => !item.done));
  const blockedPeople = team.filter((entry) => entry.person.blocked);
  const shown = filter === 'ongoing' ? ongoingPeople : filter === 'blocked' ? blockedPeople : team;

  const toggleDone = (item: Item) => {
    if (!item.done) {
      setKeepDone(new Set([...keepDone, item.id]));
    }

    run((current, context) => toggleItemDone(current, item.id, context));
  };

  const setOngoing = (item: Item, ongoing: boolean) => run((current, context) => setItemOngoing(current, item.id, ongoing, context));

  const { drag, handleProps } = useTaskDrag((item: Item, target: DropTarget) => run((current, context) => moveTaskOnPeopleBoard(current, item.id, target, context)));

  const row = (item: Item, personId: string, ongoingGroup: boolean) => {
    const dragging = drag?.itemId === item.id;
    const done = item.done;

    return (
      <div key={item.id} data-task-id={item.id} class={`task ${ongoingGroup && !done ? 'task--ongoing' : ''} ${done ? 'task--done' : ''} ${dragging ? 'task--dragging' : ''}`}>
        <button type="button" class={`task__check ${done ? 'task__check--done' : ''}`} role="checkbox" aria-checked={done} aria-label={done ? `Mark "${item.text}" as not done` : `Mark "${item.text}" as done`} onClick={() => toggleDone(item)}>
          {done ? <CheckIcon size={13} /> : null}
        </button>
        <button type="button" class="task__body" onClick={() => sheets.open({ kind: 'item', id: item.id })}>
          <span class="task__text" dir="auto">{item.text}</span>
          <span class="task__meta">{done ? 'Done · leaves the list when you leave this screen' : ongoingGroup ? since(item.ongoingSince, today) : item.day ? relativeDay(item.day, today) : ''}</span>
        </button>
        {done ? (
          <button type="button" class="link-button" onClick={() => toggleDone(item)}>Undo</button>
        ) : (
          <>
            <button type="button" class={`task__play ${ongoingGroup ? 'task__play--on' : ''}`} aria-pressed={ongoingGroup} aria-label={ongoingGroup ? `Stop "${item.text}"` : `Mark "${item.text}" as ongoing`} onClick={() => setOngoing(item, !ongoingGroup)}>
              {ongoingGroup ? <PauseIcon size={12} /> : <PlayIcon size={12} />}
            </button>
            <span class="task__grip" aria-hidden="true" {...handleProps(item, personId)}><GripIcon size={16} /></span>
          </>
        )}
      </div>
    );
  };

  return (
    <div class="stack">
      <div class="chip-row chip-row--scroll" role="group" aria-label="Filter people">
        <button type="button" class={`chip ${filter === 'everyone' ? 'chip--selected' : ''}`} aria-pressed={filter === 'everyone'} onClick={() => setFilter('everyone')}>Everyone · {team.length}</button>
        <button type="button" class={`chip ${filter === 'ongoing' ? 'chip--selected' : ''}`} aria-pressed={filter === 'ongoing'} onClick={() => setFilter('ongoing')}><span class="chip__dot" aria-hidden="true" />Ongoing · {ongoingPeople.length}</button>
        <button type="button" class={`chip ${filter === 'blocked' ? 'chip--selected' : ''}`} aria-pressed={filter === 'blocked'} onClick={() => setFilter('blocked')}>Blocked · {blockedPeople.length}</button>
      </div>
      {team.length === 0 ? <Empty>Add the people on your team to track what each one is working on.</Empty> : null}
      {team.length > 0 && shown.length === 0 ? <Empty>Nobody here right now.</Empty> : null}
      {shown.map((entry, index) => {
        const { person, ongoing, next } = entry;
        const tone = personTone(person, index);
        const overOngoing = drag?.personId === person.id && drag.target?.zone === 'ongoing';
        const overNext = drag?.personId === person.id && drag.target?.zone === 'next';

        return (
          <article key={person.id} class="card person-card">
            <div class="person-card__head">
              <span class="avatar" style={{ background: tone?.bg, color: tone?.fg }} aria-hidden="true">{initials(person.name)}</span>
              <button type="button" class="person-card__name" onClick={() => sheets.open({ kind: 'person', id: person.id })}>
                <span class="person-card__title" dir="auto">{person.name}</span>
                <span class="person-card__meta">{summary(entry)}</span>
              </button>
              {person.blocked ? <span class="tag tag--blocked">Blocked</span> : null}
            </div>
            {person.now.trim() !== '' ? (
              <div class="legacy-now">
                <span class="legacy-now__text" dir="auto"><b>Old “Now” note:</b> {person.now}</span>
                <span class="legacy-now__actions">
                  <button type="button" class="soft-button" onClick={() => run((current, context) => resolveLegacyNow(current, person.id, true, context))}>Make it an ongoing task</button>
                  <button type="button" class="link-button" onClick={() => run((current, context) => resolveLegacyNow(current, person.id, false, context))}>Dismiss</button>
                </span>
              </div>
            ) : null}
            <div class={`task-zone task-zone--ongoing ${overOngoing ? 'task-zone--over' : ''}`} data-drop-zone="ongoing" data-person-id={person.id}>
              {ongoing.map((item) => row(item, person.id, true))}
              {ongoing.every((item) => item.done) ? <p class="task-zone__hint">{overOngoing ? 'Drop to set ongoing' : 'Drag a task here, or tap ▶ on one, to mark it ongoing'}</p> : null}
            </div>
            <div class={`task-zone ${overNext ? 'task-zone--over-next' : ''}`} data-drop-zone="next" data-person-id={person.id}>
              {next.map((item) => row(item, person.id, false))}
            </div>
            <div class="card__foot">
              <button type="button" class="soft-button" onClick={() => sheets.open({ kind: 'capture', preset: { personId: person.id, spaceId, day: null } })}>+ Task for <span dir="auto">{person.name}</span></button>
              <button type="button" class="link-button" onClick={() => sheets.open({ kind: 'person', id: person.id })}>1:1 notes</button>
            </div>
          </article>
        );
      })}
    </div>
  );
};

import { teamSummary, updatePerson } from '@notebook/core';
import type { IsoDate } from '@notebook/core';
import { useState } from 'preact/hooks';
import { useNotebook } from '../../state/hooks';
import { daysAgo, initials } from '../format';
import { useSheets } from '../sheets/sheet-context';
import { ItemRow } from './ItemRow';
import { Empty } from './primitives';

type Filter = 'everyone' | 'waiting' | 'stale';

const STALE_DAYS = 3;
const AVATAR_TONES = [{ bg: '#EEF1FD', fg: '#2F4FD0' }, { bg: '#E6F4F1', fg: '#0F6B5E' }, { bg: '#F1EEF8', fg: '#5B3FA0' }, { bg: '#FDF1E3', fg: '#9A5B13' }, { bg: '#FCEBF1', fg: '#A3204F' }];

/** One card per person: what they are on now, what is open with them, and how fresh that is. */
export const PeopleBoard = ({ today, spaceId }: { today: IsoDate; spaceId: string | null }) => {
  const { document, run } = useNotebook();
  const sheets = useSheets();
  const [filter, setFilter] = useState<Filter>('everyone');
  const [editingNow, setEditingNow] = useState<{ id: string; value: string } | null>(null);
  const summaries = teamSummary(document, new Date());
  const waiting = summaries.filter((entry) => entry.open.length > 0);
  const stale = summaries.filter((entry) => entry.daysSinceUpdate === null || entry.daysSinceUpdate >= STALE_DAYS);
  const shown = filter === 'waiting' ? waiting : filter === 'stale' ? stale : summaries;

  const saveNow = () => {
    if (!editingNow) {
      return;
    }

    const { id, value } = editingNow;
    run((current, context) => updatePerson(current, id, { now: value.trim() }, context));
    setEditingNow(null);
  };

  return (
    <div class="stack">
      <div class="chip-row" role="group" aria-label="Filter people">
        <button type="button" class={`chip ${filter === 'everyone' ? 'chip--selected' : ''}`} aria-pressed={filter === 'everyone'} onClick={() => setFilter('everyone')}>Everyone · {summaries.length}</button>
        <button type="button" class={`chip ${filter === 'waiting' ? 'chip--selected' : ''}`} aria-pressed={filter === 'waiting'} onClick={() => setFilter('waiting')}>Waiting on · {waiting.length}</button>
        <button type="button" class={`chip ${filter === 'stale' ? 'chip--selected' : ''}`} aria-pressed={filter === 'stale'} onClick={() => setFilter('stale')}>Check in · {stale.length}</button>
      </div>
      {summaries.length === 0 ? <Empty>Add the people on your team to track what each one is doing.</Empty> : null}
      {summaries.length > 0 && shown.length === 0 ? <Empty>Nobody here right now.</Empty> : null}
      {shown.map(({ person, open, daysSinceUpdate }, index) => {
        const tone = AVATAR_TONES[index % AVATAR_TONES.length] ?? AVATAR_TONES[0];
        const isStale = daysSinceUpdate === null || daysSinceUpdate >= STALE_DAYS;

        return (
          <article key={person.id} class="card person-card">
            <div class="person-card__head">
              <span class="avatar" style={{ background: tone?.bg, color: tone?.fg }} aria-hidden="true">{initials(person.name)}</span>
              <button type="button" class="person-card__name" onClick={() => sheets.open({ kind: 'person', id: person.id })}>
                <span class="person-card__title" dir="auto">{person.name}</span>
                <span class="person-card__meta">{daysAgo(daysSinceUpdate)}</span>
              </button>
              {open.length > 0 ? <span class="tag tag--person">Waiting · {open.length}</span> : isStale ? <span class="tag tag--carried">Check in</span> : null}
            </div>
            <div class="person-card__line">
              <span class="person-card__label">NOW</span>
              {editingNow?.id === person.id ? (
                <form class="inline-form" onSubmit={(event) => {
                  event.preventDefault();
                  saveNow();
                }}>
                  <input class="text-input" dir="auto" aria-label={`What ${person.name} is working on`} maxLength={500} value={editingNow.value} ref={(element) => element?.focus()} onInput={(event) => setEditingNow({ id: person.id, value: event.currentTarget.value })} onBlur={saveNow} />
                </form>
              ) : (
                <button type="button" class="person-card__now" dir="auto" onClick={() => setEditingNow({ id: person.id, value: person.now })}>{person.now || 'Tap to set what they are on'}</button>
              )}
            </div>
            {open.length > 0 ? <div class="item-list">{open.map((item) => <ItemRow key={item.id} item={item} today={today} showDay />)}</div> : null}
            <div class="card__foot">
              <button type="button" class="soft-button" onClick={() => sheets.open({ kind: 'capture', preset: { personId: person.id, spaceId, day: null } })}>+ Item for {person.name}</button>
              {person.notes ? <button type="button" class="link-button" onClick={() => sheets.open({ kind: 'person', id: person.id })}>1:1 notes</button> : null}
            </div>
          </article>
        );
      })}
    </div>
  );
};

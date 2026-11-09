import { highlightParts, isOngoing, toggleItemDone } from '@notebook/core';
import type { IsoDate, Item, NotebookDocument } from '@notebook/core';
import { useNotebook } from '../../state/hooks';
import { relativeDay } from '../format';
import { BellIcon, CheckIcon } from '../icons';
import { useSheets } from '../sheets/sheet-context';

type Tag = { label: string; tone: 'person' | 'time' | 'space' | 'tag' | 'carried' | 'ongoing' };

const tagsFor = (item: Item, document: NotebookDocument, today: IsoDate, options: { showDay: boolean; carried: boolean; showSpace: boolean }): Tag[] => {
  const tags: Tag[] = [];
  const person = item.personId ? document.people[item.personId] : undefined;

  if (isOngoing(item)) {
    tags.push({ label: 'Ongoing', tone: 'ongoing' });
  }

  if (options.carried && item.day) {
    tags.push({ label: `From ${relativeDay(item.day, today)}`, tone: 'carried' });
  }

  if (person && !person.deleted) {
    tags.push({ label: `@${person.name}`, tone: 'person' });
  }

  if (item.time) {
    tags.push({ label: item.time, tone: 'time' });
  }

  if (options.showDay && item.day) {
    tags.push({ label: relativeDay(item.day, today), tone: 'time' });
  }

  const space = item.spaceId ? document.spaces[item.spaceId] : undefined;

  if (options.showSpace && space && !space.deleted) {
    tags.push({ label: space.name, tone: 'space' });
  }

  item.tags.forEach((tag) => tags.push({ label: `#${tag}`, tone: 'tag' }));

  return tags;
};

/** Renders text with every match of `query` wrapped in <mark>, as text nodes only. */
export const Highlighted = ({ text, query }: { text: string; query: string }) => <>{highlightParts(text, query).map((part, index) => (part.match ? <mark key={index}>{part.text}</mark> : part.text))}</>;

export const ItemRow = ({ item, today, showDay = false, carried = false, showSpace = false, highlight = '', onOpen }: { item: Item; today: IsoDate; showDay?: boolean; carried?: boolean; showSpace?: boolean; highlight?: string; onOpen?: () => void }) => {
  const { document, run } = useNotebook();
  const sheets = useSheets();
  const tags = tagsFor(item, document, today, { showDay, carried, showSpace });
  const isTask = item.kind === 'task';

  return (
    <div class={`item-row ${item.done ? 'item-row--done' : ''} ${isOngoing(item) ? 'item-row--ongoing' : ''}`}>
      {isTask ? (
        <button type="button" class={`checkbox ${item.done ? 'checkbox--checked' : ''}`} role="checkbox" aria-checked={item.done} aria-label={item.done ? `Mark "${item.text}" as not done` : `Mark "${item.text}" as done`} onClick={() => run((current, context) => toggleItemDone(current, item.id, context))}>
          {item.done ? <CheckIcon size={12} /> : null}
        </button>
      ) : (
        <span class={`bullet bullet--${item.kind}`} aria-hidden="true" />
      )}
      <button type="button" class="item-row__body" onClick={() => {
        onOpen?.();
        sheets.open({ kind: 'item', id: item.id });
      }}>
        <span class="item-row__text" dir="auto">{item.text ? <Highlighted text={item.text} query={highlight} /> : 'Untitled'}</span>
        {tags.length > 0 || item.remind ? (
          <span class="item-row__tags">
            {item.remind ? <span class="tag tag--time"><BellIcon size={12} /> Reminder</span> : null}
            {tags.map((tag) => <span key={tag.label} class={`tag tag--${tag.tone}`} dir="auto">{tag.label}</span>)}
          </span>
        ) : null}
      </button>
    </div>
  );
};

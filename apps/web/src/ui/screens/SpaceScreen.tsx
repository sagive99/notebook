import { addItem, itemColumnId, moveItemToColumn, spaceItems } from '@notebook/core';
import type { IsoDate, Item, ItemKind, Space } from '@notebook/core';
import { useState } from 'preact/hooks';
import { useNotebook, useToday } from '../../state/hooks';
import { CaptureBar, ScreenHeader } from '../components/chrome';
import { ItemRow } from '../components/ItemRow';
import { PeopleBoard } from '../components/PeopleBoard';
import { Card, Empty } from '../components/primitives';
import { ChevronLeftIcon, ChevronRightIcon, MoreIcon, PlusIcon } from '../icons';
import { href } from '../router';
import { useSheets } from '../sheets/sheet-context';

const QuickAdd = ({ space, kind, columnId, placeholder }: { space: Space; kind: ItemKind; columnId?: string | null; placeholder: string }) => {
  const { run } = useNotebook();
  const [text, setText] = useState('');

  return (
    <form class="quick-add" onSubmit={(event) => {
      event.preventDefault();
      const value = text.trim();

      if (value === '') {
        return;
      }

      run((current, context) => addItem(current, { kind, text: value, spaceId: space.id, columnId: columnId ?? null }, context).document);
      setText('');
    }}>
      <input class="text-input" dir="auto" aria-label={placeholder} placeholder={placeholder} value={text} onInput={(event) => setText(event.currentTarget.value)} />
      <button type="submit" class="icon-button" aria-label="Add" disabled={text.trim() === ''}><PlusIcon size={18} /></button>
    </form>
  );
};

const ListLayout = ({ space, items, today }: { space: Space; items: Item[]; today: IsoDate }) => {
  const { document } = useNotebook();
  const kind: ItemKind = space.id === document.settings.backlogSpaceId ? 'idea' : 'task';
  const [tag, setTag] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const tags = [...new Set(items.flatMap((item) => item.tags))].sort();
  const filtered = tag ? items.filter((item) => item.tags.includes(tag)) : items;
  const open = filtered.filter((item) => !item.done);
  const done = filtered.filter((item) => item.done);

  return (
    <div class="stack">
      {tags.length > 0 ? (
        <div class="chip-row chip-row--scroll" role="group" aria-label="Filter by tag">
          <button type="button" class={`chip ${tag === null ? 'chip--selected' : ''}`} aria-pressed={tag === null} onClick={() => setTag(null)}>All</button>
          {tags.map((entry) => <button key={entry} type="button" class={`chip ${tag === entry ? 'chip--selected' : ''}`} aria-pressed={tag === entry} onClick={() => setTag(entry)}>#{entry}</button>)}
        </div>
      ) : null}
      <Card>
        <QuickAdd space={space} kind={kind} placeholder={`Add to ${space.name}`} />
        <div class="item-list">{open.map((item) => <ItemRow key={item.id} item={item} today={today} showDay />)}</div>
        {open.length === 0 ? <Empty>Nothing open. Add something above or from quick capture.</Empty> : null}
        {done.length > 0 ? <button type="button" class="link-button" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}>{showDone ? 'Hide done' : `Show done (${done.length})`}</button> : null}
        {showDone ? <div class="item-list">{done.map((item) => <ItemRow key={item.id} item={item} today={today} />)}</div> : null}
      </Card>
      <p class="hint">Tap an item to give it a day, move it to Today, or send it to another space.</p>
    </div>
  );
};

const BoardLayout = ({ space, items, today }: { space: Space; items: Item[]; today: IsoDate }) => {
  const { run } = useNotebook();
  const move = (item: Item, offset: number) => {
    const index = space.columns.findIndex((column) => column.id === itemColumnId(space, item));
    const target = space.columns[index + offset];

    if (!target) {
      return;
    }

    run((current, context) => moveItemToColumn(current, item.id, target.id, context));
  };

  return (
    <div class="board" role="list">
      {space.columns.map((column, index) => {
        const cards = items.filter((item) => itemColumnId(space, item) === column.id);

        return (
          <section key={column.id} class="board__column" role="listitem" aria-label={column.name}>
            <h2 class="board__title"><span dir="auto">{column.name}</span> <span class="card__meta">{cards.length}</span></h2>
            {cards.map((item) => (
              <div key={item.id} class="board__card">
                <ItemRow item={item} today={today} showDay />
                <div class="board__moves">
                  <button type="button" class="icon-button" disabled={index === 0} aria-label={`Move "${item.text}" left`} onClick={() => move(item, -1)}><ChevronLeftIcon size={16} /></button>
                  <button type="button" class="icon-button" disabled={index === space.columns.length - 1} aria-label={`Move "${item.text}" right`} onClick={() => move(item, 1)}><ChevronRightIcon size={16} /></button>
                </div>
              </div>
            ))}
            <QuickAdd space={space} kind="task" columnId={column.id} placeholder={`Add to ${column.name}`} />
          </section>
        );
      })}
    </div>
  );
};

const NotesLayout = ({ space, items }: { space: Space; items: Item[] }) => {
  const sheets = useSheets();
  const sorted = [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  return (
    <div class="stack">
      <Card><QuickAdd space={space} kind="note" placeholder="New note title or text" /></Card>
      {sorted.length === 0 ? <Empty>No notes yet.</Empty> : null}
      {sorted.map((item) => (
        <button key={item.id} type="button" class="card note-card" onClick={() => sheets.open({ kind: 'item', id: item.id })}>
          <span class="note-card__text" dir="auto">{item.text}</span>
          <span class="card__meta">Edited {new Date(item.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
        </button>
      ))}
    </div>
  );
};

export const SpaceScreen = ({ id }: { id: string }) => {
  const { document } = useNotebook();
  const today = useToday();
  const sheets = useSheets();
  const space = document.spaces[id];

  if (!space || space.deleted) {
    return <div class="screen"><ScreenHeader title="Space not found" back={{ label: 'Spaces', href: href({ name: 'spaces' }) }} /></div>;
  }

  const items = spaceItems(document, space.id);
  const settingsLink = <a class="round-button" href={href({ name: 'space-settings', id: space.id })} aria-label={`${space.name} settings`}><MoreIcon size={18} /></a>;
  const peopleActions = <>{settingsLink}<button type="button" class="round-button round-button--dark" aria-label="Add person" onClick={() => sheets.open({ kind: 'person', id: null })}><PlusIcon size={20} /></button></>;

  return (
    <div class={`screen ${space.layout === 'list' ? 'screen--with-capture' : ''}`}>
      <ScreenHeader back={{ label: 'Spaces', href: href({ name: 'spaces' }) }} title={space.name} eyebrow={space.layout === 'people' ? 'People space' : undefined} actions={space.layout === 'people' ? peopleActions : settingsLink} />
      {space.layout === 'list' ? <ListLayout space={space} items={items} today={today} /> : null}
      {space.layout === 'board' ? <BoardLayout space={space} items={items} today={today} /> : null}
      {space.layout === 'notes' ? <NotesLayout space={space} items={items} /> : null}
      {space.layout === 'people' ? <PeopleBoard today={today} spaceId={space.id} /> : null}
      {space.layout === 'list' ? <CaptureBar label={`Add to ${space.name}…`} onOpen={() => sheets.open({ kind: 'capture', preset: { spaceId: space.id, day: null, kind: space.id === document.settings.backlogSpaceId ? 'idea' : 'task' } })} /> : null}
    </div>
  );
};

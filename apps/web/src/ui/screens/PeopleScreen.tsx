import { search } from '@notebook/core';
import { useState } from 'preact/hooks';
import { useNotebook, useToday } from '../../state/hooks';
import { ScreenHeader } from '../components/chrome';
import { ItemRow } from '../components/ItemRow';
import { PeopleBoard } from '../components/PeopleBoard';
import { Card, Empty } from '../components/primitives';
import { SPACE_COLORS, initials } from '../format';
import { PlusIcon } from '../icons';
import { href } from '../router';
import { useSheets } from '../sheets/sheet-context';

export const PeopleScreen = () => {
  const today = useToday();
  const sheets = useSheets();
  const { document } = useNotebook();

  return (
    <div class="screen">
      <ScreenHeader eyebrow="Your team" title="People" actions={<button type="button" class="round-button round-button--dark" aria-label="Add person" onClick={() => sheets.open({ kind: 'person', id: null })}><PlusIcon size={20} /></button>} />
      <PeopleBoard today={today} spaceId={document.settings.teamSpaceId && document.spaces[document.settings.teamSpaceId]?.deleted === false ? document.settings.teamSpaceId : null} />
    </div>
  );
};

export const SearchScreen = () => {
  const { document } = useNotebook();
  const today = useToday();
  const sheets = useSheets();
  const [query, setQuery] = useState('');
  const hits = search(document, query);

  return (
    <div class="screen">
      <ScreenHeader title="Search" />
      <input class="text-input text-input--search" type="search" dir="auto" aria-label="Search everything" placeholder="Tasks, notes, people, spaces" value={query} ref={(element) => element?.focus()} onInput={(event) => setQuery(event.currentTarget.value)} />
      <div class="stack">
        {query.trim() !== '' && hits.length === 0 ? <Empty>Nothing matches “{query}”.</Empty> : null}
        {hits.length > 0 ? (
          <Card>
            <div class="item-list">
              {hits.map((hit) => {
                if (hit.kind === 'item') {
                  return <ItemRow key={hit.item.id} item={hit.item} today={today} showDay showSpace />;
                }

                if (hit.kind === 'person') {
                  return <button key={hit.person.id} type="button" class="search-hit" onClick={() => sheets.open({ kind: 'person', id: hit.person.id })}><span class="avatar avatar--small" aria-hidden="true">{initials(hit.person.name)}</span><span dir="auto">{hit.person.name}</span><span class="card__meta">Person</span></button>;
                }

                return <a key={hit.space.id} class="search-hit" href={href({ name: 'space', id: hit.space.id })}><span class="space-mark space-mark--small" style={{ background: SPACE_COLORS[hit.space.color].bg, color: SPACE_COLORS[hit.space.color].fg }} aria-hidden="true">{initials(hit.space.name).charAt(0)}</span><span dir="auto">{hit.space.name}</span><span class="card__meta">Space</span></a>;
              })}
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
};

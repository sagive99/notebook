import { liveSpaces, spaceItems } from '@notebook/core';
import type { NotebookDocument, Space } from '@notebook/core';
import { useNotebook } from '../../state/hooks';
import { ScreenHeader } from '../components/chrome';
import { SPACE_COLORS, initials } from '../format';
import { PlusIcon } from '../icons';
import { href } from '../router';

const LAYOUT_LABEL: Record<Space['layout'], string> = { list: 'List', board: 'Board', people: 'People', notes: 'Notes' };

const summary = (document: NotebookDocument, space: Space): string => {
  if (space.layout === 'people') {
    const count = Object.values(document.people).filter((person) => !person.deleted).length;

    return `People · ${count} ${count === 1 ? 'person' : 'people'}`;
  }

  const items = spaceItems(document, space.id);

  if (space.layout === 'notes') {
    return `Notes · ${items.length} ${items.length === 1 ? 'page' : 'pages'}`;
  }

  const open = items.filter((item) => !item.done).length;

  return `${LAYOUT_LABEL[space.layout]} · ${open} open`;
};

export const SpacesScreen = () => {
  const { document } = useNotebook();
  const spaces = liveSpaces(document);
  const pinned = new Set(document.settings.todayBlocks.filter((block) => block.enabled).map((block) => block.id));

  return (
    <div class="screen">
      <ScreenHeader eyebrow="Everything else" title="Spaces" actions={<a class="round-button round-button--dark" href={href({ name: 'new-space' })} aria-label="New space"><PlusIcon size={20} /></a>} />
      <div class="space-grid">
        {spaces.map((space) => (
          <a key={space.id} class="space-tile" href={href({ name: 'space', id: space.id })}>
            <span class="space-tile__top">
              <span class="space-mark" style={{ background: SPACE_COLORS[space.color].bg, color: SPACE_COLORS[space.color].fg }} aria-hidden="true">{initials(space.name).charAt(0)}</span>
              {space.showOnToday || pinned.has(`space:${space.id}`) ? <span class="tag tag--time">On Today</span> : null}
            </span>
            <span class="space-tile__name" dir="auto">{space.name}</span>
            <span class="space-tile__meta">{summary(document, space)}</span>
          </a>
        ))}
        <a class="space-tile space-tile--new" href={href({ name: 'new-space' })}>
          <PlusIcon />
          <span>New space</span>
        </a>
      </div>
    </div>
  );
};

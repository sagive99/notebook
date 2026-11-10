import { dayPage, notebookSections, setNotebookSectionCollapsed } from '@notebook/core';
import type { IsoDate, NotebookSection } from '@notebook/core';
import { useState } from 'preact/hooks';
import { useNotebook } from '../../state/hooks';
import { ItemRow } from '../components/ItemRow';
import { Card, Empty } from '../components/primitives';
import { SECTION_DEFAULT_COLORS, SECTION_LABELS, SPACE_COLORS } from '../format';
import { ChevronDownIcon } from '../icons';
import { useSheets } from '../sheets/sheet-context';

export const NotebookBlock = ({ day, today, hideWork = false }: { day: IsoDate; today: IsoDate; hideWork?: boolean }) => {
  const { document, run } = useNotebook();
  const sheets = useSheets();
  const [showDone, setShowDone] = useState(false);
  const page = dayPage(document, day, today, { hideWork });
  const sections = notebookSections(document, page);
  const carriedIds = new Set(page.carried.map((item) => item.id));
  const openCount = page.open.filter((item) => item.kind === 'task').length + page.carried.length;
  // A page with nothing but the user's own day needs no heading: it reads as one plain list.
  const plain = sections.length === 1 && sections[0]?.id === 'mine';

  // Outside Team every linked task is the user's own, and inside it the space is the team's: those tags say nothing.
  const rows = (section: NotebookSection) => (
    <div class="item-list">
      {section.items.map((item) => <ItemRow key={item.id} item={item} today={today} carried={carriedIds.has(item.id)} showSpace={section.id !== 'team'} showPerson={section.id === 'team'} quiet={section.id === 'team'} />)}
    </div>
  );

  return (
    <Card>
      <div class="card__head">
        <h2 class="card__title">Notebook</h2>
        <span class="card__meta">{openCount} open · {page.done.length} done</span>
      </div>
      {sections.map((section) => {
        if (plain) {
          return rows(section);
        }

        const tone = SPACE_COLORS[section.color ?? SECTION_DEFAULT_COLORS[section.id]];

        return (
          <section key={section.id} class="nb-section" style={{ '--section': tone.swatch, '--section-ink': tone.fg, '--section-soft': tone.bg }}>
            <h3 class="nb-section__head">
              <button type="button" class="nb-section__toggle" aria-expanded={!section.collapsed} onClick={() => run((current, context) => setNotebookSectionCollapsed(current, section.id, !section.collapsed, context))}>
                {SECTION_LABELS[section.id]}
                <span class="nb-section__count">{section.items.length}</span>
                <span class={section.collapsed ? 'card__chevron card__chevron--closed' : 'card__chevron'}><ChevronDownIcon size={16} /></span>
              </button>
            </h3>
            {section.collapsed ? null : rows(section)}
          </section>
        );
      })}
      {sections.length === 0 ? <Empty>{day === today ? 'A clean page. Tap “Write anything…” to add a task or note.' : 'Nothing written for this day yet.'}</Empty> : null}
      <div class="card__foot">
        <button type="button" class="soft-button" onClick={() => sheets.open({ kind: 'capture', preset: { day } })}>+ Add to this day</button>
        {page.done.length > 0 ? <button type="button" class="link-button" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}>{showDone ? 'Hide done' : `Show done (${page.done.length})`}</button> : null}
      </div>
      {showDone ? <div class="item-list">{page.done.map((item) => <ItemRow key={item.id} item={item} today={today} />)}</div> : null}
    </Card>
  );
};

import { dayPage } from '@notebook/core';
import type { IsoDate } from '@notebook/core';
import { useState } from 'preact/hooks';
import { useNotebook } from '../../state/hooks';
import { ItemRow } from '../components/ItemRow';
import { Card, Empty } from '../components/primitives';
import { useSheets } from '../sheets/sheet-context';

export const NotebookBlock = ({ day, today, hideWork = false }: { day: IsoDate; today: IsoDate; hideWork?: boolean }) => {
  const { document } = useNotebook();
  const sheets = useSheets();
  const [showDone, setShowDone] = useState(false);
  const page = dayPage(document, day, today, { hideWork });
  const openCount = page.open.filter((item) => item.kind === 'task').length + page.carried.length;

  return (
    <Card>
      <div class="card__head">
        <h2 class="card__title">Notebook</h2>
        <span class="card__meta">{openCount} open · {page.done.length} done</span>
      </div>
      {page.carried.length > 0 ? (
        <div class="carried-note"><span class="tag tag--carried">Carried over</span><span>{page.carried.length === 1 ? '1 unfinished task' : `${page.carried.length} unfinished tasks`} from earlier days</span></div>
      ) : null}
      <div class="item-list">
        {page.carried.map((item) => <ItemRow key={item.id} item={item} today={today} carried />)}
        {page.open.map((item) => <ItemRow key={item.id} item={item} today={today} showSpace />)}
      </div>
      {page.carried.length === 0 && page.open.length === 0 ? <Empty>{day === today ? 'A clean page. Tap “Write anything…” to add a task or note.' : 'Nothing written for this day yet.'}</Empty> : null}
      <div class="card__foot">
        <button type="button" class="soft-button" onClick={() => sheets.open({ kind: 'capture', preset: { day } })}>+ Add to this day</button>
        {page.done.length > 0 ? <button type="button" class="link-button" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}>{showDone ? 'Hide done' : `Show done (${page.done.length})`}</button> : null}
      </div>
      {showDone ? <div class="item-list">{page.done.map((item) => <ItemRow key={item.id} item={item} today={today} />)}</div> : null}
    </Card>
  );
};

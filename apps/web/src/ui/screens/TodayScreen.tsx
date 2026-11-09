import { addDays, todayBlocks, weekOf } from '@notebook/core';
import type { IsoDate } from '@notebook/core';
import { useEffect, useState } from 'preact/hooks';
import { useNotebook, useToday } from '../../state/hooks';
import { BacklogPickBlock, GmailBlock, SpaceBlock, TeamBlock } from '../blocks/SmallBlocks';
import { NotebookBlock } from '../blocks/NotebookBlock';
import { ScheduleBlock } from '../blocks/ScheduleBlock';
import { CaptureBar, SyncBanner, SyncDot } from '../components/chrome';
import { dayNumber, formatDayMonth, formatWeekday, relativeDay, weekdayLetter } from '../format';
import { ChevronLeftIcon, ChevronRightIcon, SlidersIcon } from '../icons';
import { href } from '../router';
import { useSheets } from '../sheets/sheet-context';

export const TodayScreen = () => {
  const today = useToday();
  const [day, setDay] = useState<IsoDate>(today);
  const { document } = useNotebook();
  const sheets = useSheets();
  const week = weekOf(day);

  useEffect(() => {
    setDay(today);
  }, [today]);

  const blocks = todayBlocks(document).filter((block) => block.enabled);

  return (
    <div class="screen">
      <header class="screen-header">
        <div class="screen-header__row">
          <div class="screen-header__titles">
            <span class="screen-header__eyebrow">{day === today ? formatWeekday(day) : `${formatWeekday(day)} · ${relativeDay(day, today)}`} <SyncDot /></span>
            <h1 class="screen-header__title">{formatDayMonth(day)}</h1>
          </div>
          <a class="round-button" href={href({ name: 'customize' })} aria-label="Customize Today"><SlidersIcon size={20} /></a>
        </div>
        <div class="week-strip">
          <button type="button" class="week-strip__shift" aria-label="Previous week" onClick={() => setDay(addDays(day, -7))}><ChevronLeftIcon size={16} /></button>
          {week.map((date) => (
            <button key={date} type="button" class={`week-strip__day ${date === day ? 'week-strip__day--selected' : ''} ${date === today ? 'week-strip__day--today' : ''}`} aria-pressed={date === day} aria-label={relativeDay(date, today)} onClick={() => setDay(date)}>
              <span class="week-strip__letter">{weekdayLetter(date)}</span>
              <span class="week-strip__number">{dayNumber(date)}</span>
            </button>
          ))}
          <button type="button" class="week-strip__shift" aria-label="Next week" onClick={() => setDay(addDays(day, 7))}><ChevronRightIcon size={16} /></button>
        </div>
        {day !== today ? <button type="button" class="link-button back-to-today" onClick={() => setDay(today)}>Back to today</button> : null}
      </header>
      <SyncBanner />
      <div class="stack">
        {blocks.map((block) => {
          switch (block.id) {
            case 'schedule':
              return <ScheduleBlock key={block.id} day={day} />;
            case 'notebook':
              return <NotebookBlock key={block.id} day={day} today={today} />;
            case 'team-waiting':
              return <TeamBlock key={block.id} />;
            case 'gmail-starred':
              return <GmailBlock key={block.id} today={today} />;
            case 'backlog-pick':
              return <BacklogPickBlock key={block.id} today={today} />;
            default:
              return <SpaceBlock key={block.id} spaceId={block.id.slice('space:'.length)} today={today} />;
          }
        })}
        {blocks.length === 0 ? <p class="empty">Every block is hidden. Turn some on in Customize.</p> : null}
      </div>
      <CaptureBar onOpen={() => sheets.open({ kind: 'capture', preset: day === today ? {} : { day } })} />
    </div>
  );
};

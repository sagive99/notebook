import { addDays, visibleTodayBlocks, weekOf } from '@notebook/core';
import type { IsoDate } from '@notebook/core';
import { useEffect, useState } from 'preact/hooks';
import { useNotebook, useServices, useToday } from '../../state/hooks';
import { openShortcut, reminderHandoff, staleReminders } from '../../state/reminders-handoff';
import { BacklogPickBlock, GmailBlock, SpaceBlock, TeamBlock } from '../blocks/SmallBlocks';
import { NotebookBlock } from '../blocks/NotebookBlock';
import { ScheduleBlock } from '../blocks/ScheduleBlock';
import { CaptureBar, SyncBanner, SyncDot } from '../components/chrome';
import { dayNumber, formatDayMonth, formatWeekday, relativeDay, weekdayLetter } from '../format';
import { BellIcon, BriefcaseIcon, ChevronLeftIcon, ChevronRightIcon, SlidersIcon } from '../icons';
import { href } from '../router';
import { useSheets } from '../sheets/sheet-context';

/** Offers to bring the iPhone Reminders app up to date after calendar-side or other-device changes (ADR 0007). */
const RemindersBanner = () => {
  const { document } = useNotebook();
  const [, setSent] = useState(0);
  const stale = staleReminders(document, new Date());
  const first = stale[0];

  if (first === undefined) {
    return null;
  }

  return (
    <div class="banner" role="status">
      <BellIcon size={18} />
      <span class="banner__text">{stale.length === 1 ? '1 reminder to update' : `${stale.length} reminders to update`} in the Reminders app</span>
      <button type="button" class="pill-button pill-button--small" onClick={() => {
        openShortcut(reminderHandoff(first, document.items[first]));
        setSent((count) => count + 1);
      }}>Update</button>
    </div>
  );
};

export const TodayScreen = () => {
  const today = useToday();
  const [day, setDay] = useState<IsoDate>(today);
  const { document } = useNotebook();
  const sheets = useSheets();
  const services = useServices();
  const [workHidden, setWorkHidden] = useState(services.workHidden);
  const week = weekOf(day);

  const toggleWork = () => {
    services.setWorkHidden(!workHidden);
    setWorkHidden(!workHidden);
  };

  useEffect(() => {
    setDay(today);
  }, [today]);

  const blocks = visibleTodayBlocks(document, workHidden);

  return (
    <div class="screen">
      <header class="screen-header">
        <div class="screen-header__row">
          <div class="screen-header__titles">
            <span class="screen-header__eyebrow">{day === today ? formatWeekday(day) : `${formatWeekday(day)} · ${relativeDay(day, today)}`} <SyncDot /></span>
            <h1 class="screen-header__title">{formatDayMonth(day)}</h1>
          </div>
          <div class="screen-header__actions">
            <button type="button" role="switch" aria-checked={!workHidden} aria-label="Work" class={`work-switch ${workHidden ? '' : 'work-switch--on'}`} onClick={toggleWork}><BriefcaseIcon size={16} />{workHidden ? 'Work off' : 'Work on'}</button>
            <a class="round-button" href={href({ name: 'customize' })} aria-label="Customize Today"><SlidersIcon size={20} /></a>
          </div>
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
      <RemindersBanner />
      <div class="stack">
        {blocks.map((block) => {
          switch (block.id) {
            case 'schedule':
              return <ScheduleBlock key={block.id} day={day} hideWork={workHidden} />;
            case 'notebook':
              return <NotebookBlock key={block.id} day={day} today={today} hideWork={workHidden} />;
            case 'team-waiting':
              return <TeamBlock key={block.id} />;
            case 'gmail-starred':
              return <GmailBlock key={block.id} today={today} />;
            case 'backlog-pick':
              return <BacklogPickBlock key={block.id} today={today} hideWork={workHidden} />;
            default:
              return <SpaceBlock key={block.id} spaceId={block.id.slice('space:'.length)} today={today} hideWork={workHidden} />;
          }
        })}
        {blocks.length === 0 ? <p class="empty">Every block is hidden. Turn some on in Customize.</p> : null}
        {workHidden ? <p class="hint work-note">Work is switched off: team tasks, work spaces and work calendars are hidden here. Nothing is deleted.</p> : null}
      </div>
      <CaptureBar onOpen={() => sheets.open({ kind: 'capture', preset: day === today ? {} : { day } })} />
    </div>
  );
};

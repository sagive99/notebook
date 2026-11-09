import { compareIsoDates } from './dates';
import type { IsoDate, Item, NotebookDocument, Person, Space, TodayBlock } from './types';

const live = <T extends { deleted: boolean }>(values: Record<string, T>): T[] => Object.values(values).filter((value) => !value.deleted);

const byOrder = <T extends { order: number }>(left: T, right: T): number => left.order - right.order;

/** True while a task is being worked on (an ongoing task that was finished is no longer ongoing). */
export const isOngoing = (item: Item): boolean => item.ongoingSince !== null && !item.done;

const byTimeThenOrder = (left: Item, right: Item): number => {
  if (isOngoing(left) !== isOngoing(right)) {
    return isOngoing(left) ? -1 : 1;
  }

  if (left.time && right.time) {
    return left.time.localeCompare(right.time) || left.order - right.order;
  }

  if (left.time || right.time) {
    return left.time ? -1 : 1;
  }

  return left.order - right.order;
};

export const liveItems = (document: NotebookDocument): Item[] => live(document.items);
export const livePeople = (document: NotebookDocument): Person[] => live(document.people).sort(byOrder);
export const liveSpaces = (document: NotebookDocument): Space[] => live(document.spaces).sort(byOrder);

/** An item belongs on a day page when it is a notebook item, or lives in a space that shows on Today. */
const visibleOnDayPages = (document: NotebookDocument, item: Item): boolean => {
  if (item.spaceId === null) {
    return true;
  }

  const space = document.spaces[item.spaceId];

  return Boolean(space && !space.deleted && space.showOnToday);
};

export type DayPage = {
  /** Unfinished tasks from earlier days, shown only on the real today when carry-over is on. */
  carried: Item[];
  open: Item[];
  done: Item[];
};

export const dayPage = (document: NotebookDocument, day: IsoDate, today: IsoDate): DayPage => {
  const visible = liveItems(document).filter((item) => visibleOnDayPages(document, item));
  const candidates = visible.filter((item) => item.day !== null);
  // On today's page, ongoing tasks from any day (or none) join the open list, so what's being worked on is always first.
  const ongoingElsewhere = day === today ? visible.filter((item) => isOngoing(item) && item.day !== today) : [];
  const onDay = [...candidates.filter((item) => item.day === day), ...ongoingElsewhere];
  const carried = day === today && document.settings.carryOver
    ? candidates.filter((item) => item.kind === 'task' && !item.done && !isOngoing(item) && item.day !== null && compareIsoDates(item.day, today) < 0).sort((left, right) => compareIsoDates(left.day ?? '', right.day ?? '') || left.order - right.order)
    : [];

  return {
    carried,
    open: onDay.filter((item) => !item.done).sort(byTimeThenOrder),
    done: onDay.filter((item) => item.done).sort((left, right) => (left.doneAt ?? '').localeCompare(right.doneAt ?? '')),
  };
};

export const spaceItems = (document: NotebookDocument, spaceId: string): Item[] => liveItems(document).filter((item) => item.spaceId === spaceId).sort(byOrder);

export type PersonTasks = {
  person: Person;
  /** Tasks being worked on, oldest first. */
  ongoing: Item[];
  /** The person's other open tasks, in their manual order. */
  next: Item[];
};

/**
 * A person's tasks for the People board. Finished tasks are left out, except those in `keepDone`
 * (finished during the current visit), which stay in place so a tick doesn't make the row jump away.
 */
export const personTasks = (document: NotebookDocument, person: Person, keepDone: ReadonlySet<string> = new Set()): PersonTasks => {
  const tasks = liveItems(document).filter((item) => item.kind === 'task' && item.personId === person.id && (!item.done || keepDone.has(item.id)));

  return {
    person,
    ongoing: tasks.filter((item) => item.ongoingSince !== null).sort((left, right) => (left.ongoingSince ?? '').localeCompare(right.ongoingSince ?? '') || left.order - right.order),
    next: tasks.filter((item) => item.ongoingSince === null).sort(byOrder),
  };
};

export const teamTasks = (document: NotebookDocument, keepDone: ReadonlySet<string> = new Set()): PersonTasks[] => livePeople(document).map((person) => personTasks(document, person, keepDone));

export const blockedCount = (document: NotebookDocument): number => livePeople(document).filter((person) => person.blocked).length;

export const waitingCount = (document: NotebookDocument): number => liveItems(document).filter((item) => item.kind === 'task' && !item.done && item.personId !== null).length;

/** The configured Today blocks, followed by a disabled entry for every space not yet listed. */
export const todayBlocks = (document: NotebookDocument): TodayBlock[] => {
  const spaces = liveSpaces(document);
  const configured = document.settings.todayBlocks.filter((block) => !block.id.startsWith('space:') || spaces.some((space) => block.id === `space:${space.id}`));
  const listed = new Set(configured.map((block) => block.id));
  const extra = spaces.filter((space) => !listed.has(`space:${space.id}`)).map((space): TodayBlock => ({ id: `space:${space.id}`, enabled: false }));

  return [...configured, ...extra];
};

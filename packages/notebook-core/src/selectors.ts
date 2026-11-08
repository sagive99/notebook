import { compareIsoDates } from './dates';
import type { IsoDate, Item, NotebookDocument, Person, Space, TodayBlock } from './types';

const live = <T extends { deleted: boolean }>(values: Record<string, T>): T[] => Object.values(values).filter((value) => !value.deleted);

const byOrder = <T extends { order: number }>(left: T, right: T): number => left.order - right.order;

const byTimeThenOrder = (left: Item, right: Item): number => {
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
  const candidates = liveItems(document).filter((item) => item.day !== null && visibleOnDayPages(document, item));
  const onDay = candidates.filter((item) => item.day === day);
  const carried = day === today && document.settings.carryOver
    ? candidates.filter((item) => item.kind === 'task' && !item.done && item.day !== null && compareIsoDates(item.day, today) < 0).sort((left, right) => compareIsoDates(left.day ?? '', right.day ?? '') || left.order - right.order)
    : [];

  return {
    carried,
    open: onDay.filter((item) => !item.done).sort(byTimeThenOrder),
    done: onDay.filter((item) => item.done).sort((left, right) => (left.doneAt ?? '').localeCompare(right.doneAt ?? '')),
  };
};

export const spaceItems = (document: NotebookDocument, spaceId: string): Item[] => liveItems(document).filter((item) => item.spaceId === spaceId).sort(byOrder);

export type PersonSummary = {
  person: Person;
  /** Open tasks linked to the person: things you are waiting on or owe them. */
  open: Item[];
  /** Days since their "now" line was last updated, or null when never set. */
  daysSinceUpdate: number | null;
};

const MS_PER_DAY = 86_400_000;

export const teamSummary = (document: NotebookDocument, now: Date): PersonSummary[] => {
  const items = liveItems(document).filter((item) => item.kind === 'task' && !item.done && item.personId !== null);

  return livePeople(document).map((person) => ({
    person,
    open: items.filter((item) => item.personId === person.id).sort(byOrder),
    daysSinceUpdate: person.nowUpdatedAt === null ? null : Math.max(0, Math.floor((now.getTime() - new Date(person.nowUpdatedAt).getTime()) / MS_PER_DAY)),
  }));
};

export const waitingCount = (document: NotebookDocument): number => liveItems(document).filter((item) => item.kind === 'task' && !item.done && item.personId !== null).length;

/** The configured Today blocks, followed by a disabled entry for every space not yet listed. */
export const todayBlocks = (document: NotebookDocument): TodayBlock[] => {
  const spaces = liveSpaces(document);
  const configured = document.settings.todayBlocks.filter((block) => !block.id.startsWith('space:') || spaces.some((space) => block.id === `space:${space.id}`));
  const listed = new Set(configured.map((block) => block.id));
  const extra = spaces.filter((space) => !listed.has(`space:${space.id}`)).map((space): TodayBlock => ({ id: `space:${space.id}`, enabled: false }));

  return [...configured, ...extra];
};

export type SearchHit = { kind: 'item'; item: Item } | { kind: 'person'; person: Person } | { kind: 'space'; space: Space };

export const search = (document: NotebookDocument, query: string, limit = 50): SearchHit[] => {
  const needle = query.trim().toLocaleLowerCase();

  if (needle.length === 0) {
    return [];
  }

  const matches = (value: string): boolean => value.toLocaleLowerCase().includes(needle);
  const spaces = liveSpaces(document).filter((space) => matches(space.name)).map((space): SearchHit => ({ kind: 'space', space }));
  const people = livePeople(document).filter((person) => matches(person.name) || matches(person.now) || matches(person.notes)).map((person): SearchHit => ({ kind: 'person', person }));
  const items = liveItems(document)
    .filter((item) => matches(item.text) || item.tags.some(matches))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((item): SearchHit => ({ kind: 'item', item }));

  return [...spaces, ...people, ...items].slice(0, limit);
};

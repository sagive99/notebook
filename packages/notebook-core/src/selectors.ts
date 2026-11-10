import { compareIsoDates } from './dates';
import type { IsoDate, Item, NotebookDocument, Person, Settings, Space, SpaceColor, TodayBlock } from './types';

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

/** A space is work when marked so; until the user chooses, People-layout spaces (the team) count as work. */
export const isWorkSpace = (space: Pick<Space, 'work' | 'layout'>): boolean => space.work ?? space.layout === 'people';

/** Work items are those linked to a team member or living in a work space. Loose notebook items are not work. */
export const isWorkItem = (document: NotebookDocument, item: Item): boolean => {
  const space = item.spaceId ? document.spaces[item.spaceId] : undefined;

  return item.personId !== null || Boolean(space && !space.deleted && isWorkSpace(space));
};

/** The given items minus work ones while Work is switched off; every Today list goes through this. */
export const withoutWork = (document: NotebookDocument, items: ReadonlyArray<Item>, hideWork: boolean): Item[] => (hideWork ? items.filter((item) => !isWorkItem(document, item)) : [...items]);

/** A calendar event is work when its calendar is marked Work, or it is the reminder of a work item. */
export const isWorkEvent = (document: NotebookDocument, event: { calendarId: string; notebookItemId: string | null }, workCalendarIds: ReadonlyArray<string>): boolean => {
  const item = event.notebookItemId ? document.items[event.notebookItemId] : undefined;

  return workCalendarIds.includes(event.calendarId) || Boolean(item && !item.deleted && isWorkItem(document, item));
};

export type DayPageOptions = {
  /** Leave work items out, for when the user has switched Work off on Today. */
  hideWork?: boolean;
};

export const dayPage = (document: NotebookDocument, day: IsoDate, today: IsoDate, options: DayPageOptions = {}): DayPage => {
  const visible = withoutWork(document, liveItems(document), options.hideWork ?? false).filter((item) => visibleOnDayPages(document, item));
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

export const NOTEBOOK_SECTION_IDS = ['carried', 'mine', 'team'] as const;

export type NotebookSectionId = (typeof NOTEBOOK_SECTION_IDS)[number];

export type NotebookSection = {
  id: NotebookSectionId;
  items: Item[];
  collapsed: boolean;
  /** The colour the user chose for the section, or null for the app's default. */
  color: SpaceColor | null;
};

const SELF_NAMES: ReadonlyArray<string> = ['me', 'אני'];

/** The roster entry that is the user: the chosen one, or, until one is chosen, a person named "Me" / "אני". */
export const selfPersonId = (document: NotebookDocument): string | null => {
  const chosen = document.settings.selfPersonId ? document.people[document.settings.selfPersonId] : undefined;

  if (chosen && !chosen.deleted) {
    return chosen.id;
  }

  return livePeople(document).find((person) => SELF_NAMES.includes(person.name.trim().toLowerCase()))?.id ?? null;
};

/**
 * The Notebook block's sections for a day page, empty ones left out: the user's carried-over tasks, the rest of their
 * day, and the team's tasks (linked to anyone but the user, carried or not) grouped by person in roster order.
 */
export const notebookSections = (document: NotebookDocument, page: DayPage): NotebookSection[] => {
  const self = selfPersonId(document);
  const rosterPosition = new Map(livePeople(document).map((person, index) => [person.id, index]));
  const isTeam = (item: Item): boolean => item.personId !== null && item.personId !== self && rosterPosition.has(item.personId);
  const position = (item: Item): number => rosterPosition.get(item.personId ?? '') ?? 0;
  const items: Record<NotebookSectionId, Item[]> = {
    carried: page.carried.filter((item) => !isTeam(item)),
    mine: page.open.filter((item) => !isTeam(item)),
    team: [...page.open, ...page.carried].filter(isTeam).map((item, index) => ({ item, index })).sort((left, right) => position(left.item) - position(right.item) || left.index - right.index).map(({ item }) => item),
  };

  return NOTEBOOK_SECTION_IDS.filter((id) => items[id].length > 0).map((id) => ({ id, items: items[id], collapsed: document.settings.notebookCollapsedSections.includes(id), color: document.settings.notebookSectionColors[id] ?? null }));
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

/** The blocks to render on Today: the enabled ones, minus work blocks while Work is switched off. */
export const visibleTodayBlocks = (document: NotebookDocument, hideWork: boolean): TodayBlock[] => {
  const isWorkSpaceId = (id: string | null): boolean => {
    const space = id ? document.spaces[id] : undefined;

    return Boolean(space && !space.deleted && isWorkSpace(space));
  };
  const isWorkBlock = (block: TodayBlock): boolean => block.id === 'team-waiting' || (block.id === 'backlog-pick' && isWorkSpaceId(document.settings.backlogSpaceId)) || (block.id.startsWith('space:') && isWorkSpaceId(block.id.slice('space:'.length)));

  return todayBlocks(document).filter((block) => block.enabled && !(hideWork && isWorkBlock(block)));
};

/** Reminder items get a Google Calendar event unless the user turned that off (Settings.calendarForReminders). */
export const remindersUseCalendar = (settings: Pick<Settings, 'calendarForReminders'>): boolean => settings.calendarForReminders !== false;

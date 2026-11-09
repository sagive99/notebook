import { DOCUMENT_VERSION } from './schemas';
import type { BoardColumn, CommandContext, Item, ItemKind, NotebookDocument, Person, Settings, Space, SpaceColor, SpaceFields, SpaceLayout, TodayBlock, TodayBlockId } from './types';

export const DEFAULT_TODAY_BLOCKS: TodayBlock[] = [
  { id: 'schedule', enabled: true },
  { id: 'notebook', enabled: true },
  { id: 'team-waiting', enabled: true },
  { id: 'gmail-starred', enabled: false },
  { id: 'backlog-pick', enabled: false },
];

export const DEFAULT_BOARD_COLUMNS: ReadonlyArray<Omit<BoardColumn, 'id'>> = [{ name: 'To do' }, { name: 'Doing' }, { name: 'Done' }];

const stamp = (context: CommandContext): string => context.now.toISOString();

/** A new, empty notebook with the two starter spaces the design shows: an ideas backlog and a team board. */
export const createDocument = (context: CommandContext): NotebookDocument => {
  const now = stamp(context);
  const backlog: Space = {
    id: context.newId(),
    createdAt: now,
    updatedAt: now,
    deleted: false,
    name: 'Ideas backlog',
    color: 'blue',
    layout: 'list',
    fields: { dueDate: false, person: false, priority: false, link: false, tags: true },
    columns: [],
    showOnToday: false,
    work: null,
    inCapture: true,
    order: 1,
  };
  const team: Space = {
    id: context.newId(),
    createdAt: now,
    updatedAt: now,
    deleted: false,
    name: 'Team',
    color: 'orange',
    layout: 'people',
    fields: { dueDate: true, person: true, priority: false, link: false, tags: false },
    columns: [],
    showOnToday: true,
    work: null,
    inCapture: true,
    order: 0,
  };

  return {
    version: DOCUMENT_VERSION,
    items: {},
    people: {},
    spaces: { [team.id]: team, [backlog.id]: backlog },
    settings: {
      updatedAt: now,
      todayBlocks: DEFAULT_TODAY_BLOCKS.map((block) => ({ ...block })),
      carryOver: true,
      eveningCutoff: '18:00',
      backlogSpaceId: backlog.id,
      teamSpaceId: team.id,
      collapsedBlocks: [],
      dismissedEmails: [],
    },
  };
};

export type NewItemInput = {
  kind: ItemKind;
  text: string;
  day?: string | null;
  time?: string | null;
  remind?: boolean;
  spaceId?: string | null;
  columnId?: string | null;
  personId?: string | null;
  tags?: string[];
  sourceEmailId?: string | null;
};

const nextOrder = (values: ReadonlyArray<{ order: number }>): number => values.reduce((max, { order }) => Math.max(max, order), -1) + 1;

export const addItem = (document: NotebookDocument, input: NewItemInput, context: CommandContext): { document: NotebookDocument; item: Item } => {
  const now = stamp(context);
  const item: Item = {
    id: context.newId(),
    createdAt: now,
    updatedAt: now,
    deleted: false,
    kind: input.kind,
    text: input.text.trim(),
    done: false,
    doneAt: null,
    ongoingSince: null,
    day: input.day ?? null,
    time: input.time ?? null,
    remind: input.remind ?? false,
    calendarEventId: null,
    spaceId: input.spaceId ?? null,
    columnId: input.columnId ?? null,
    personId: input.personId ?? null,
    priority: null,
    link: null,
    tags: input.tags ?? [],
    sourceEmailId: input.sourceEmailId ?? null,
    order: nextOrder(Object.values(document.items)),
  };

  return { document: { ...document, items: { ...document.items, [item.id]: item } }, item };
};

export type ItemPatch = Partial<Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'deleted'>>;

export const updateItem = (document: NotebookDocument, id: string, patch: ItemPatch, context: CommandContext): NotebookDocument => {
  const current = document.items[id];

  if (!current || current.deleted) {
    return document;
  }

  const doneChanged = patch.done !== undefined && patch.done !== current.done;
  const doneAt = doneChanged ? (patch.done ? stamp(context) : null) : current.doneAt;
  const next: Item = { ...current, ...patch, doneAt, updatedAt: stamp(context) };

  return { ...document, items: { ...document.items, [id]: next } };
};

/**
 * Puts an item on a day page. Items in a space that does not show on Today (such as the ideas backlog)
 * move into the notebook, otherwise the move would be invisible.
 */
export const scheduleItem = (document: NotebookDocument, id: string, day: string, context: CommandContext): NotebookDocument => {
  const current = document.items[id];

  if (!current || current.deleted) {
    return document;
  }

  const space = current.spaceId ? document.spaces[current.spaceId] : undefined;
  const leavesSpace = Boolean(space) && !(space && !space.deleted && space.showOnToday);
  const patch: ItemPatch = { day, done: false, ...(leavesSpace ? { spaceId: null, columnId: null } : {}), ...(current.kind === 'idea' ? { kind: 'task' } : {}) };

  return updateItem(document, id, patch, context);
};

/** Marks a task as being worked on now, or stops it. Ongoing tasks sort first wherever tasks are listed. */
export const setItemOngoing = (document: NotebookDocument, id: string, ongoing: boolean, context: CommandContext): NotebookDocument => {
  const current = document.items[id];

  if (!current || current.deleted || (current.ongoingSince !== null) === ongoing) {
    return document;
  }

  return updateItem(document, id, { ongoingSince: ongoing ? context.now.toISOString() : null, ...(ongoing ? { done: false } : {}) }, context);
};

/**
 * Moves an item to sit just before another one (or last when `beforeId` is null) among `siblings`, keeping the rest
 * in order. `order` is one number per item, shared by every list that shows it (Today, its space, People).
 */
export const placeItemBefore = (document: NotebookDocument, id: string, beforeId: string | null, siblings: ReadonlyArray<Item>, context: CommandContext): NotebookDocument => {
  const others = siblings.filter((item) => item.id !== id);
  const index = beforeId === null ? others.length : others.findIndex((item) => item.id === beforeId);

  if (index < 0 || !document.items[id]) {
    return document;
  }

  const previous = others[index - 1]?.order;
  const next = others[index]?.order;

  // No room left between the neighbours (equal orders, or the gap halved too often): renumber the siblings.
  if (previous !== undefined && next !== undefined && next - previous < MIN_ORDER_GAP) {
    const renumbered = [...others.slice(0, index), document.items[id], ...others.slice(index)].reduce((current, item, position) => (item && current.items[item.id]?.order !== position ? updateItem(current, item.id, { order: position }, context) : current), document);

    return renumbered;
  }

  const order = previous === undefined && next === undefined ? 0 : previous === undefined ? (next ?? 0) - 1 : next === undefined ? previous + 1 : (previous + next) / 2;

  return updateItem(document, id, { order }, context);
};

const MIN_ORDER_GAP = 1e-6;

export const toggleItemDone = (document: NotebookDocument, id: string, context: CommandContext): NotebookDocument => {
  const current = document.items[id];

  if (!current) {
    return document;
  }

  return updateItem(document, id, { done: !current.done }, context);
};

/** Deletion keeps a tombstone so the removal survives merging with other devices. */
export const deleteItem = (document: NotebookDocument, id: string, context: CommandContext): NotebookDocument => {
  const current = document.items[id];

  if (!current) {
    return document;
  }

  return { ...document, items: { ...document.items, [id]: { ...current, deleted: true, updatedAt: stamp(context) } } };
};

export const addPerson = (document: NotebookDocument, name: string, context: CommandContext): { document: NotebookDocument; person: Person } => {
  const now = stamp(context);
  const person: Person = {
    id: context.newId(),
    createdAt: now,
    updatedAt: now,
    deleted: false,
    name: name.trim(),
    now: '',
    nowUpdatedAt: null,
    blocked: false,
    notes: '',
    order: nextOrder(Object.values(document.people)),
  };

  return { document: { ...document, people: { ...document.people, [person.id]: person } }, person };
};

export type PersonPatch = Partial<Pick<Person, 'name' | 'now' | 'notes' | 'order' | 'blocked'>>;

export const updatePerson = (document: NotebookDocument, id: string, patch: PersonPatch, context: CommandContext): NotebookDocument => {
  const current = document.people[id];

  if (!current || current.deleted) {
    return document;
  }

  const now = stamp(context);
  const nowUpdatedAt = patch.now !== undefined && patch.now !== current.now ? now : current.nowUpdatedAt;

  return { ...document, people: { ...document.people, [id]: { ...current, ...patch, nowUpdatedAt, updatedAt: now } } };
};

/** Removes a person; their items stay and simply lose the person link. */
export const deletePerson = (document: NotebookDocument, id: string, context: CommandContext): NotebookDocument => {
  const current = document.people[id];

  if (!current) {
    return document;
  }

  const now = stamp(context);
  const items = Object.fromEntries(Object.entries(document.items).map(([itemId, item]) => [itemId, item.personId === id ? { ...item, personId: null, updatedAt: now } : item]));

  return { ...document, items, people: { ...document.people, [id]: { ...current, deleted: true, updatedAt: now } } };
};

export type NewSpaceInput = {
  /** Lets callers know the new space's id up front, e.g. to navigate to it; generated when omitted. */
  id?: string;
  name: string;
  color: SpaceColor;
  layout: SpaceLayout;
  fields: SpaceFields;
  showOnToday: boolean;
  work?: boolean | null;
  inCapture: boolean;
};

export const addSpace = (document: NotebookDocument, input: NewSpaceInput, context: CommandContext): { document: NotebookDocument; space: Space } => {
  const now = stamp(context);
  const columns = input.layout === 'board' ? DEFAULT_BOARD_COLUMNS.map(({ name }) => ({ id: context.newId(), name })) : [];
  const space: Space = {
    id: input.id ?? context.newId(),
    createdAt: now,
    updatedAt: now,
    deleted: false,
    name: input.name.trim(),
    color: input.color,
    layout: input.layout,
    fields: input.fields,
    columns,
    showOnToday: input.showOnToday,
    work: input.work ?? null,
    inCapture: input.inCapture,
    order: nextOrder(Object.values(document.spaces)),
  };

  return { document: { ...document, spaces: { ...document.spaces, [space.id]: space } }, space };
};

export type SpacePatch = Partial<Pick<Space, 'name' | 'color' | 'fields' | 'columns' | 'showOnToday' | 'work' | 'inCapture' | 'order'>>;

export const updateSpace = (document: NotebookDocument, id: string, patch: SpacePatch, context: CommandContext): NotebookDocument => {
  const current = document.spaces[id];

  if (!current || current.deleted) {
    return document;
  }

  return { ...document, spaces: { ...document.spaces, [id]: { ...current, ...patch, updatedAt: stamp(context) } } };
};

/** Deletes a space and tombstones its items, and drops any Today block pinned from it. */
export const deleteSpace = (document: NotebookDocument, id: string, context: CommandContext): NotebookDocument => {
  const current = document.spaces[id];

  if (!current) {
    return document;
  }

  const now = stamp(context);
  const items = Object.fromEntries(Object.entries(document.items).map(([itemId, item]) => [itemId, item.spaceId === id && !item.deleted ? { ...item, deleted: true, updatedAt: now } : item]));
  const settings: Settings = {
    ...document.settings,
    todayBlocks: document.settings.todayBlocks.filter((block) => block.id !== `space:${id}`),
    backlogSpaceId: document.settings.backlogSpaceId === id ? null : document.settings.backlogSpaceId,
    teamSpaceId: document.settings.teamSpaceId === id ? null : document.settings.teamSpaceId,
    updatedAt: now,
  };

  return { ...document, items, settings, spaces: { ...document.spaces, [id]: { ...current, deleted: true, updatedAt: now } } };
};

export type SettingsPatch = Partial<Omit<Settings, 'updatedAt'>>;

export const updateSettings = (document: NotebookDocument, patch: SettingsPatch, context: CommandContext): NotebookDocument => ({
  ...document,
  settings: { ...document.settings, ...patch, updatedAt: stamp(context) },
});

/** Folds a Today block down to its header, or opens it again. */
export const setTodayBlockCollapsed = (document: NotebookDocument, id: TodayBlockId, collapsed: boolean, context: CommandContext): NotebookDocument => {
  const others = document.settings.collapsedBlocks.filter((blockId) => blockId !== id);

  return updateSettings(document, { collapsedBlocks: collapsed ? [...others, id] : others }, context);
};

/** Dismissals older than this are dropped: the Gmail block only lists the last 7 days of mail. */
export const DISMISSED_EMAIL_TTL_DAYS = 14;

/** Hides a Gmail message from the Important in Gmail block, and forgets dismissals too old to matter. */
export const dismissEmail = (document: NotebookDocument, emailId: string, context: CommandContext): NotebookDocument => {
  const cutoff = new Date(context.now.getTime() - DISMISSED_EMAIL_TTL_DAYS * 86_400_000).toISOString();
  const kept = document.settings.dismissedEmails.filter((entry) => entry.id !== emailId && entry.dismissedAt >= cutoff);

  return updateSettings(document, { dismissedEmails: [...kept, { id: emailId, dismissedAt: stamp(context) }].slice(-500) }, context);
};

/** Shows a dismissed Gmail message again (Undo). */
export const restoreEmail = (document: NotebookDocument, emailId: string, context: CommandContext): NotebookDocument => updateSettings(document, { dismissedEmails: document.settings.dismissedEmails.filter((entry) => entry.id !== emailId) }, context);

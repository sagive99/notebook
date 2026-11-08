import { DOCUMENT_VERSION } from './schemas';
import type { BoardColumn, CommandContext, Item, ItemKind, NotebookDocument, Person, Settings, Space, SpaceColor, SpaceFields, SpaceLayout, TodayBlock } from './types';

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
    inCapture: input.inCapture,
    order: nextOrder(Object.values(document.spaces)),
  };

  return { document: { ...document, spaces: { ...document.spaces, [space.id]: space } }, space };
};

export type SpacePatch = Partial<Pick<Space, 'name' | 'color' | 'fields' | 'columns' | 'showOnToday' | 'inCapture' | 'order'>>;

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

import { z } from 'zod';

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, 'Expected YYYY-MM-DD');
export const clockTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u, 'Expected HH:MM');
export const timestampSchema = z.string().min(1);

const entityFields = {
  id: z.string().min(1).max(64),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  deleted: z.boolean().default(false),
};

export const itemKindSchema = z.enum(['task', 'note', 'idea']);
export const prioritySchema = z.enum(['low', 'normal', 'high']);

export const itemSchema = z.object({
  ...entityFields,
  kind: itemKindSchema,
  text: z.string().max(10_000),
  done: z.boolean().default(false),
  doneAt: timestampSchema.nullable().default(null),
  /**
   * Set while a task is being worked on; kept when done so Undo returns it to ongoing. Added after v1, hence the default.
   * An older app version drops it when it saves the item; that is accepted: the task falls back to "up next".
   */
  ongoingSince: timestampSchema.nullable().default(null),
  day: isoDateSchema.nullable().default(null),
  time: clockTimeSchema.nullable().default(null),
  remind: z.boolean().default(false),
  calendarEventId: z.string().max(1024).nullable().default(null),
  spaceId: z.string().max(64).nullable().default(null),
  columnId: z.string().max(64).nullable().default(null),
  personId: z.string().max(64).nullable().default(null),
  priority: prioritySchema.nullable().default(null),
  link: z.string().max(2048).nullable().default(null),
  tags: z.array(z.string().max(64)).max(32).default([]),
  sourceEmailId: z.string().max(256).nullable().default(null),
  order: z.number().finite().default(0),
});

export const personSchema = z.object({
  ...entityFields,
  name: z.string().min(1).max(120),
  /**
   * Deprecated: the free-text "now" line, replaced by ongoing tasks. Kept so a save from this version doesn't erase text
   * that older versions still show and edit; the People board offers to turn it into an ongoing task.
   */
  now: z.string().max(500).default(''),
  /** Deprecated with `now`. */
  nowUpdatedAt: timestampSchema.nullable().default(null),
  /** Blocked on something outside their control; added after v1 shipped, hence the default. */
  blocked: z.boolean().default(false),
  notes: z.string().max(20_000).default(''),
  order: z.number().finite().default(0),
});

export const spaceLayoutSchema = z.enum(['list', 'board', 'people', 'notes']);

export const spaceFieldsSchema = z.object({
  dueDate: z.boolean().default(true),
  person: z.boolean().default(false),
  priority: z.boolean().default(false),
  link: z.boolean().default(false),
  tags: z.boolean().default(false),
});

export const boardColumnSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(60),
});

export const spaceColorSchema = z.enum(['teal', 'blue', 'orange', 'purple', 'rose', 'slate']);

export const spaceSchema = z.object({
  ...entityFields,
  name: z.string().min(1).max(80),
  color: spaceColorSchema,
  layout: spaceLayoutSchema,
  fields: spaceFieldsSchema,
  columns: z.array(boardColumnSchema).max(12).default([]),
  showOnToday: z.boolean().default(false),
  /**
   * Whether the space is work. Null means "not chosen yet": People-layout spaces then count as work (see `isWorkSpace`).
   * Added after v1, hence the default. An older app version re-saves spaces without it; merge restores the chosen value
   * (see the tie-break in merge.ts) unless that older device also edited the space, which resets it to "not chosen".
   */
  work: z.boolean().nullable().default(null),
  inCapture: z.boolean().default(true),
  order: z.number().finite().default(0),
});

export const todayBlockIdSchema = z.union([
  z.enum(['schedule', 'notebook', 'team-waiting', 'gmail-starred', 'backlog-pick']),
  z.string().regex(/^space:[\w-]{1,64}$/u),
]);

export const todayBlockSchema = z.object({
  id: todayBlockIdSchema,
  enabled: z.boolean(),
});

export const settingsSchema = z.object({
  updatedAt: timestampSchema,
  todayBlocks: z.array(todayBlockSchema).max(40),
  carryOver: z.boolean().default(true),
  eveningCutoff: clockTimeSchema.default('18:00'),
  backlogSpaceId: z.string().max(64).nullable().default(null),
  teamSpaceId: z.string().max(64).nullable().default(null),
  /**
   * Whether "reminder" items also get a Google Calendar event. null means the default (yes), so an older
   * app version that drops the field falls back to the original behaviour rather than to a wrong value.
   */
  calendarForReminders: z.boolean().nullable().default(null),
});

export const DOCUMENT_VERSION = 1;

export const notebookDocumentSchema = z.object({
  version: z.literal(DOCUMENT_VERSION),
  items: z.record(z.string(), itemSchema),
  people: z.record(z.string(), personSchema),
  spaces: z.record(z.string(), spaceSchema),
  settings: settingsSchema,
});

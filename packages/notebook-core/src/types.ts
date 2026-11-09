import type { z } from 'zod';
import type { boardColumnSchema, dismissedEmailSchema, itemKindSchema, itemSchema, notebookDocumentSchema, personSchema, prioritySchema, settingsSchema, spaceColorSchema, spaceFieldsSchema, spaceLayoutSchema, spaceSchema, todayBlockIdSchema, todayBlockSchema } from './schemas';

export type Item = z.infer<typeof itemSchema>;
export type ItemKind = z.infer<typeof itemKindSchema>;
export type Priority = z.infer<typeof prioritySchema>;
export type Person = z.infer<typeof personSchema>;
export type Space = z.infer<typeof spaceSchema>;
export type SpaceLayout = z.infer<typeof spaceLayoutSchema>;
export type SpaceFields = z.infer<typeof spaceFieldsSchema>;
export type SpaceColor = z.infer<typeof spaceColorSchema>;
export type BoardColumn = z.infer<typeof boardColumnSchema>;
export type TodayBlockId = z.infer<typeof todayBlockIdSchema>;
export type TodayBlock = z.infer<typeof todayBlockSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type DismissedEmail = z.infer<typeof dismissedEmailSchema>;
export type NotebookDocument = z.infer<typeof notebookDocumentSchema>;

/** A calendar date in the user's local time zone, formatted YYYY-MM-DD. */
export type IsoDate = string;

/** A wall-clock time, formatted HH:MM (24h). */
export type ClockTime = string;

/** Supplies time and identifiers so domain commands stay deterministic in tests. */
export type CommandContext = {
  now: Date;
  newId: () => string;
};

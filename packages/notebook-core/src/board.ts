import { updateItem } from './document';
import { liveItems } from './selectors';
import type { CommandContext, Item, NotebookDocument, Space } from './types';

/** The column an item shows in: its own when it still exists, otherwise the board's first column. */
export const itemColumnId = (space: Space, item: Item): string | null => (item.columnId && space.columns.some((column) => column.id === item.columnId) ? item.columnId : space.columns[0]?.id ?? null);

/** On a board with two or more columns, the last column means done. */
export const isDoneColumn = (space: Space, columnId: string | null): boolean => space.columns.length > 1 && columnId !== null && space.columns.at(-1)?.id === columnId;

/** Unfinished items of a space: not checked off, and on boards not in the done column. */
export const openSpaceItems = (document: NotebookDocument, spaceId: string): Item[] => {
  const space = document.spaces[spaceId];

  if (!space || space.deleted) {
    return [];
  }

  return liveItems(document)
    .filter((item) => item.spaceId === spaceId && !item.done && (space.layout !== 'board' || !isDoneColumn(space, itemColumnId(space, item))))
    .sort((left, right) => left.order - right.order);
};

/** Moves a board card; landing in the done column completes it, leaving it reopens it. */
export const moveItemToColumn = (document: NotebookDocument, id: string, columnId: string, context: CommandContext): NotebookDocument => {
  const item = document.items[id];
  const space = item?.spaceId ? document.spaces[item.spaceId] : undefined;

  if (!item || !space || !space.columns.some((column) => column.id === columnId)) {
    return document;
  }

  return updateItem(document, id, { columnId, done: isDoneColumn(space, columnId) }, context);
};

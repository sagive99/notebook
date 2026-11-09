import { addItem, placeItemBefore, setItemOngoing, updatePerson } from './document';
import { personTasks } from './selectors';
import type { CommandContext, NotebookDocument } from './types';

export type PeopleBoardTarget = { zone: 'ongoing' | 'next'; beforeId: string | null };

/**
 * Applies a drop on the People board: into "ongoing" starts the task; into "up next" stops it and places it before
 * `beforeId`. Siblings are read from the document being changed, so a sync that landed mid-drag can't skew the order.
 */
export const moveTaskOnPeopleBoard = (document: NotebookDocument, id: string, target: PeopleBoardTarget, context: CommandContext): NotebookDocument => {
  const item = document.items[id];
  const person = item?.personId ? document.people[item.personId] : undefined;

  if (!item || item.deleted || !person || person.deleted) {
    return document;
  }

  if (target.zone === 'ongoing') {
    return setItemOngoing(document, id, true, context);
  }

  const stopped = setItemOngoing(document, id, false, context);

  return placeItemBefore(stopped, id, target.beforeId, personTasks(stopped, person).next, context);
};

/**
 * Turns a person's legacy free-text "now" line (from before ongoing tasks existed) into an ongoing task, and clears it.
 * With `keepAsTask: false` it only clears the line.
 */
export const resolveLegacyNow = (document: NotebookDocument, personId: string, keepAsTask: boolean, context: CommandContext): NotebookDocument => {
  const person = document.people[personId];

  if (!person || person.deleted || person.now.trim() === '') {
    return document;
  }

  const cleared = updatePerson(document, personId, { now: '' }, context);

  if (!keepAsTask) {
    return cleared;
  }

  const added = addItem(cleared, { kind: 'task', text: person.now.trim(), personId }, context);

  return setItemOngoing(added.document, added.item.id, true, context);
};

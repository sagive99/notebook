import { describe, expect, it } from 'vitest';
import { itemColumnId, moveItemToColumn, openSpaceItems } from './board';
import { addItem, addSpace, createDocument, scheduleItem } from './document';
import { dayPage } from './selectors';
import { testContext } from './test-support';

const boardFixture = () => {
  const context = testContext();
  const board = addSpace(createDocument(context), { name: 'Work', color: 'teal', layout: 'board', fields: { dueDate: true, person: false, priority: false, link: false, tags: false }, showOnToday: false, inCapture: true }, context);
  const card = addItem(board.document, { kind: 'task', text: 'Design review', spaceId: board.space.id }, context);

  return { context, space: board.space, document: card.document, id: card.item.id };
};

describe('board rules', () => {
  it('falls back to the first column and completes cards moved to the last column', () => {
    const { context, space, document, id } = boardFixture();
    const [todo, , done] = space.columns;

    const card = document.items[id];

    expect(card && itemColumnId(space, card)).toBe(todo?.id);

    const moved = moveItemToColumn(document, id, done?.id ?? '', context);

    expect(moved.items[id]).toMatchObject({ columnId: done?.id, done: true });
    expect(openSpaceItems(moved, space.id)).toEqual([]);

    const back = moveItemToColumn(moved, id, todo?.id ?? '', context);

    expect(back.items[id]?.done).toBe(false);
    expect(openSpaceItems(back, space.id).map((item) => item.text)).toEqual(['Design review']);
  });

  it('ignores moves to columns of another board', () => {
    const { context, document, id } = boardFixture();

    expect(moveItemToColumn(document, id, 'missing', context)).toBe(document);
  });
});

describe('scheduleItem', () => {
  it('moves a backlog idea onto the day page as a task', () => {
    const context = testContext();
    const document = createDocument(context);
    const backlogId = document.settings.backlogSpaceId ?? '';
    const idea = addItem(document, { kind: 'idea', text: 'Weekly sync per person', spaceId: backlogId }, context);

    const scheduled = scheduleItem(idea.document, idea.item.id, '2026-11-09', context);

    expect(scheduled.items[idea.item.id]).toMatchObject({ kind: 'task', spaceId: null, day: '2026-11-09' });
    expect(dayPage(scheduled, '2026-11-09', '2026-11-09').open.map((item) => item.text)).toEqual(['Weekly sync per person']);
  });

  it('keeps items in spaces that already show on Today', () => {
    const context = testContext();
    const document = createDocument(context);
    const teamId = document.settings.teamSpaceId ?? '';
    const task = addItem(document, { kind: 'task', text: 'CR for Dana', spaceId: teamId }, context);

    expect(scheduleItem(task.document, task.item.id, '2026-11-10', context).items[task.item.id]).toMatchObject({ spaceId: teamId, day: '2026-11-10' });
  });
});

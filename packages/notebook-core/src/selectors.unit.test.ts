import { describe, expect, it } from 'vitest';
import { addItem, addPerson, addSpace, createDocument, deleteSpace, toggleItemDone, updatePerson, updateSettings } from './document';
import { dayPage, search, teamSummary, todayBlocks } from './selectors';
import { testContext } from './test-support';

describe('dayPage', () => {
  it('carries unfinished tasks from earlier days onto today only', () => {
    const context = testContext();
    const base = createDocument(context);
    const old = addItem(base, { kind: 'task', text: 'old task', day: '2026-11-08' }, context);
    const oldNote = addItem(old.document, { kind: 'note', text: 'old note', day: '2026-11-08' }, context);
    const today = addItem(oldNote.document, { kind: 'task', text: 'today task', day: '2026-11-09', time: '14:15' }, context);
    const untimed = addItem(today.document, { kind: 'task', text: 'untimed', day: '2026-11-09' }, context);

    const page = dayPage(untimed.document, '2026-11-09', '2026-11-09');

    expect(page.carried.map((item) => item.text)).toEqual(['old task']);
    expect(page.open.map((item) => item.text)).toEqual(['today task', 'untimed']);
    expect(dayPage(untimed.document, '2026-11-10', '2026-11-09').carried).toEqual([]);
  });

  it('respects the carry-over setting and finished tasks', () => {
    const context = testContext();
    const added = addItem(createDocument(context), { kind: 'task', text: 'old', day: '2026-11-01' }, context);
    const off = updateSettings(added.document, { carryOver: false }, context);

    expect(dayPage(off, '2026-11-09', '2026-11-09').carried).toEqual([]);

    const done = toggleItemDone(added.document, added.item.id, context);

    expect(dayPage(done, '2026-11-09', '2026-11-09').carried).toEqual([]);
  });

  it('shows dated space items only for spaces pinned to Today', () => {
    const context = testContext();
    const document = createDocument(context);
    const hidden = addSpace(document, { name: 'Private', color: 'slate', layout: 'list', fields: { dueDate: true, person: false, priority: false, link: false, tags: false }, showOnToday: false, inCapture: true }, context);
    const item = addItem(hidden.document, { kind: 'task', text: 'in hidden space', day: '2026-11-09', spaceId: hidden.space.id }, context);

    expect(dayPage(item.document, '2026-11-09', '2026-11-09').open).toEqual([]);
  });
});

describe('teamSummary', () => {
  it('lists open person-linked tasks and staleness', () => {
    const context = testContext('2026-11-05T09:00:00');
    const withPerson = addPerson(createDocument(context), 'Omer', context);
    const updated = updatePerson(withPerson.document, withPerson.person.id, { now: 'Deploying map layers' }, context);
    const task = addItem(updated, { kind: 'task', text: 'deploy status', personId: withPerson.person.id }, context);

    const [summary] = teamSummary(task.document, new Date('2026-11-09T10:00:00'));

    expect(summary?.open.map((item) => item.text)).toEqual(['deploy status']);
    expect(summary?.daysSinceUpdate).toBe(4);
  });
});

describe('todayBlocks', () => {
  it('appends spaces as disabled blocks and drops blocks of deleted spaces', () => {
    const context = testContext();
    const document = createDocument(context);
    const spaceId = Object.keys(document.spaces)[0] ?? '';
    const pinned = updateSettings(document, { todayBlocks: [...document.settings.todayBlocks, { id: `space:${spaceId}`, enabled: true }] }, context);

    expect(todayBlocks(pinned).filter((block) => block.id.startsWith('space:'))).toHaveLength(2);
    expect(todayBlocks(deleteSpace(pinned, spaceId, context)).some((block) => block.id === `space:${spaceId}`)).toBe(false);
  });
});

describe('search', () => {
  it('finds items, people and spaces case-insensitively', () => {
    const context = testContext();
    const person = addPerson(createDocument(context), 'Noa', context);
    const item = addItem(person.document, { kind: 'idea', text: 'Learn about QUIC', tags: ['someday'] }, context);

    expect(search(item.document, 'quic').map((hit) => hit.kind)).toEqual(['item']);
    expect(search(item.document, 'noa').map((hit) => hit.kind)).toEqual(['person']);
    expect(search(item.document, 'backlog').map((hit) => hit.kind)).toEqual(['space']);
    expect(search(item.document, '   ')).toEqual([]);
  });
});

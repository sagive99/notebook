import { describe, expect, it } from 'vitest';
import { addItem, addPerson, addSpace, createDocument, deleteSpace, setItemOngoing, toggleItemDone, updateSettings, updateSpace } from './document';
import { parseDocument } from './merge';
import { mergeDocuments } from './merge';
import { dayPage, isWorkEvent, isWorkSpace, liveItems, todayBlocks, visibleTodayBlocks, withoutWork } from './selectors';
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

    const ongoing = setItemOngoing(untimed.document, untimed.item.id, true, context);

    expect(dayPage(ongoing, '2026-11-09', '2026-11-09').open.map((item) => item.text)).toEqual(['untimed', 'today task']);
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

describe('work switch', () => {
  const fixture = () => {
    const context = testContext();
    const base = createDocument(context);
    const teamId = base.settings.teamSpaceId ?? '';
    const backlogId = base.settings.backlogSpaceId ?? '';
    const person = addPerson(base, 'Dana', context);
    const loose = addItem(person.document, { kind: 'task', text: 'Buy milk', day: '2026-11-09' }, context);
    const forDana = addItem(loose.document, { kind: 'task', text: 'CR for Dana', day: '2026-11-09', personId: person.person.id }, context);
    const inTeam = addItem(forDana.document, { kind: 'task', text: 'Team retro prep', day: '2026-11-09', spaceId: teamId }, context);
    const undated = addItem(inTeam.document, { kind: 'task', text: 'Ongoing for Dana', personId: person.person.id }, context);
    const ongoing = setItemOngoing(undated.document, undated.item.id, true, context);

    return { context, document: ongoing, teamId, backlogId };
  };
  const texts = (items: ReadonlyArray<{ text: string }>) => items.map((item) => item.text).sort();

  it('hides items linked to people or in work spaces, and keeps loose notebook items', () => {
    const { document } = fixture();

    expect(texts(dayPage(document, '2026-11-09', '2026-11-09').open)).toEqual(['Buy milk', 'CR for Dana', 'Ongoing for Dana', 'Team retro prep']);
    expect(texts(dayPage(document, '2026-11-09', '2026-11-09', { hideWork: true }).open)).toEqual(['Buy milk']);
  });

  it('treats People-layout spaces as work until the user chooses, and respects the choice', () => {
    const { context, document, teamId, backlogId } = fixture();

    const team = document.spaces[teamId];
    const backlog = document.spaces[backlogId];

    expect(team && isWorkSpace(team)).toBe(true);
    expect(backlog && isWorkSpace(backlog)).toBe(false);

    const teamPersonal = updateSpace(document, teamId, { work: false }, context);

    expect(texts(dayPage(teamPersonal, '2026-11-09', '2026-11-09', { hideWork: true }).open)).toEqual(['Buy milk', 'Team retro prep']);
  });

  it('drops work blocks from Today while Work is off', () => {
    const { context, document, backlogId } = fixture();
    const pinned = updateSettings(document, { todayBlocks: [...document.settings.todayBlocks.map((block) => ({ ...block, enabled: true })), { id: `space:${backlogId}`, enabled: true }] }, context);
    const ids = (hideWork: boolean, source = pinned) => visibleTodayBlocks(source, hideWork).map((block) => block.id);

    expect(ids(false)).toContain('team-waiting');
    expect(ids(true)).toEqual(['schedule', 'notebook', 'gmail-starred', 'backlog-pick', `space:${backlogId}`]);

    const workBacklog = updateSpace(pinned, backlogId, { work: true }, context);

    expect(ids(true, workBacklog)).toEqual(['schedule', 'notebook', 'gmail-starred']);
  });

  it('reads spaces stored before the work flag existed', () => {
    const { document, teamId } = fixture();
    const raw = JSON.parse(JSON.stringify(document)) as { spaces: Record<string, Record<string, unknown>> };
    Object.values(raw.spaces).forEach((space) => {
      delete space.work;
    });
    const parsed = parseDocument(raw);

    expect(parsed.ok && parsed.document.spaces[teamId]?.work).toBeNull();
  });

  it('filters any item list and recognises work calendar events and work reminders', () => {
    const { document } = fixture();
    const all = liveItems(document);
    const workItem = all.find((item) => item.text === 'CR for Dana');
    const looseItem = all.find((item) => item.text === 'Buy milk');

    expect(texts(withoutWork(document, all, true))).toEqual(['Buy milk']);
    expect(withoutWork(document, all, false)).toHaveLength(all.length);
    expect(isWorkEvent(document, { calendarId: 'team@group', notebookItemId: null }, ['team@group'])).toBe(true);
    expect(isWorkEvent(document, { calendarId: 'primary', notebookItemId: workItem?.id ?? null }, [])).toBe(true);
    expect(isWorkEvent(document, { calendarId: 'primary', notebookItemId: looseItem?.id ?? null }, ['team@group'])).toBe(false);
  });

  it('keeps an explicit work choice when an older app version re-saves the space without the flag', () => {
    const { context, document, teamId, backlogId } = fixture();
    const chosen = updateSpace(updateSpace(document, teamId, { work: false }, context), backlogId, { work: true }, context);
    const raw = JSON.parse(JSON.stringify(chosen)) as { spaces: Record<string, Record<string, unknown>> };
    Object.values(raw.spaces).forEach((space) => {
      delete space.work;
    });
    const olderSave = parseDocument(raw);

    if (!olderSave.ok) {
      throw new Error(olderSave.error);
    }

    [mergeDocuments(chosen, olderSave.document), mergeDocuments(olderSave.document, chosen)].forEach((merged) => {
      expect(merged.spaces[teamId]?.work).toBe(false);
      expect(merged.spaces[backlogId]?.work).toBe(true);
    });
  });
});

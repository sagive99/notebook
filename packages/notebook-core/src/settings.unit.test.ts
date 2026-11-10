import { expect, it } from 'vitest';
import { addPerson, createDocument, dismissEmail, restoreEmail, setNotebookSectionCollapsed, setNotebookSectionColor, setTodayBlockCollapsed } from './document';
import { parseDocument } from './merge';
import { testContext } from './test-support';

it('collapses and opens a Today block', () => {
  const context = testContext();
  const collapsed = setTodayBlockCollapsed(createDocument(context), 'gmail-starred', true, context);

  expect(collapsed.settings.collapsedBlocks).toEqual(['gmail-starred']);
  expect(setTodayBlockCollapsed(collapsed, 'gmail-starred', true, context).settings.collapsedBlocks).toEqual(['gmail-starred']);
  expect(setTodayBlockCollapsed(collapsed, 'gmail-starred', false, context).settings.collapsedBlocks).toEqual([]);
});

it('dismisses an email, restores it, and forgets dismissals older than 14 days', () => {
  const context = testContext('2026-11-01T09:00:00Z');
  const first = dismissEmail(createDocument(context), 'old', context);
  context.advance(15 * 24 * 60);
  const second = dismissEmail(first, 'new', context);

  expect(second.settings.dismissedEmails).toEqual([{ id: 'new', dismissedAt: '2026-11-16T09:00:00.000Z' }]);
  expect(second.settings.updatedAt).toBe('2026-11-16T09:00:00.000Z');
  expect(restoreEmail(second, 'new', context).settings.dismissedEmails).toEqual([]);
});

it('folds a Notebook section and remembers its colour', () => {
  const context = testContext();
  const folded = setNotebookSectionCollapsed(createDocument(context), 'team', true, context);

  expect(folded.settings.notebookCollapsedSections).toEqual(['team']);
  expect(setNotebookSectionCollapsed(folded, 'team', true, context).settings.notebookCollapsedSections).toEqual(['team']);
  expect(setNotebookSectionCollapsed(folded, 'team', false, context).settings.notebookCollapsedSections).toEqual([]);
  expect(setNotebookSectionColor(folded, 'team', 'purple', context).settings.notebookSectionColors).toEqual({ team: 'purple' });
});

it('parses a document written before sections, person colours and "this is me" existed', () => {
  const context = testContext();
  const current = addPerson(createDocument(context), 'Or', context);
  const without = (value: object, keys: string[]) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
  const oldSettings = without(current.document.settings, ['selfPersonId', 'notebookCollapsedSections', 'notebookSectionColors']);
  const oldPerson = without(current.person, ['color']);
  const parsed = parseDocument({ ...current.document, settings: oldSettings, people: { [current.person.id]: oldPerson } });

  expect(parsed.ok && parsed.document.settings).toMatchObject({ selfPersonId: null, notebookCollapsedSections: [], notebookSectionColors: {} });
  expect(parsed.ok && parsed.document.people[current.person.id]?.color).toBeNull();
});

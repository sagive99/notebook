import { expect, it } from 'vitest';
import { createDocument, dismissEmail, restoreEmail, setTodayBlockCollapsed } from './document';
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

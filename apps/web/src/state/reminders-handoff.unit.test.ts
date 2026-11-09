import { itemSchema } from '@notebook/core';
import type { Item } from '@notebook/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { REMINDERS_SENT_KEY, reminderHandoff, setRemindersEnabled, staleReminders, testReminderUrl } from './reminders-handoff';

const item = (overrides: Partial<Item> = {}): Item => itemSchema.parse({
  id: 'a1', createdAt: '2026-11-09T20:00:00.000Z', updatedAt: '2026-11-09T20:00:00.000Z', deleted: false,
  kind: 'task', text: 'להתגלח', day: '2026-11-09', time: '22:30', remind: true, ...overrides,
});

const payload = (url: string | null): unknown => {
  expect(url).not.toBeNull();
  const parsed = new URL(url ?? '');

  expect(parsed.protocol).toBe('shortcuts:');
  expect(parsed.searchParams.get('name')).toBe('Notebook Reminder');
  expect(parsed.searchParams.get('input')).toBe('text');

  return JSON.parse(parsed.searchParams.get('text') ?? '');
};

describe('reminders handoff', () => {
  beforeEach(() => {
    localStorage.clear();
    setRemindersEnabled(true);
  });

  it('does nothing while switched off', () => {
    setRemindersEnabled(false);

    expect(reminderHandoff('a1', item())).toBeNull();
  });

  it('sends a new reminder once, then only when the title or time changes', () => {
    expect(payload(reminderHandoff('a1', item()))).toEqual({ action: 'add', tag: 'notebook:a1', title: 'להתגלח', due: expect.stringMatching(/^2026-11-09T22:30:00[+-]\d{2}:\d{2}$/u) });
    expect(reminderHandoff('a1', item({ priority: 'high' }))).toBeNull();
    expect(payload(reminderHandoff('a1', item({ time: '23:00' })))).toMatchObject({ action: 'add', due: expect.stringMatching(/^2026-11-09T23:00:00[+-]\d{2}:\d{2}$/u) });
  });

  it('uses the default morning time for a day without a time', () => {
    expect(payload(reminderHandoff('a1', item({ time: null })))).toMatchObject({ due: expect.stringMatching(/^2026-11-09T08:30:00[+-]\d{2}:\d{2}$/u) });
  });

  it('removes a sent reminder when the item stops wanting one, and only then', () => {
    expect(reminderHandoff('a2', item({ remind: false }))).toBeNull();
    reminderHandoff('a1', item());

    expect(payload(reminderHandoff('a1', item({ remind: false })))).toEqual({ action: 'remove', tag: 'notebook:a1' });
    expect(reminderHandoff('a1', item({ remind: false }))).toBeNull();

    reminderHandoff('a1', item());

    expect(payload(reminderHandoff('a1', undefined))).toMatchObject({ action: 'remove' });
  });

  it('survives corrupted storage', () => {
    localStorage.setItem(REMINDERS_SENT_KEY, '["nope"]');

    expect(payload(reminderHandoff('a1', item()))).toMatchObject({ action: 'add' });
  });

  it('sends a time that points at the same moment as the item', () => {
    const due = (payload(reminderHandoff('a1', item())) as { due: string }).due;

    expect(Date.parse(due)).toBe(new Date(2026, 10, 9, 22, 30).getTime());
  });

  it('builds a test reminder two minutes ahead', () => {
    expect(payload(testReminderUrl(new Date(2026, 10, 9, 23, 59)))).toMatchObject({ due: expect.stringMatching(/^2026-11-10T00:01:00[+-]\d{2}:\d{2}$/u), tag: 'notebook:test' });
  });
});

describe('stale reminders', () => {
  beforeEach(() => {
    localStorage.clear();
    setRemindersEnabled(true);
  });

  const doc = (...items: Item[]) => ({ items: Object.fromEntries(items.map((entry) => [entry.id, entry])) });

  it('lists upcoming reminders the Reminders app has not got, or got before a calendar edit', () => {
    const sent = item({ id: 'sent' });
    reminderHandoff('sent', sent);
    reminderHandoff('moved', item({ id: 'moved' }));
    reminderHandoff('off', item({ id: 'off' }));

    expect(staleReminders(doc(
      sent,
      item({ id: 'moved', time: '21:00' }),
      item({ id: 'off', remind: false }),
      item({ id: 'new' }),
      item({ id: 'past', day: '2026-11-01' }),
      item({ id: 'done', done: true }),
      item({ id: 'earlier', time: '08:00' }),
    ), new Date(2026, 10, 9, 21, 0)).sort()).toEqual(['moved', 'new', 'off']);
  });

  it('is empty while the handoff is off', () => {
    setRemindersEnabled(false);

    expect(staleReminders(doc(item({ id: 'new' })), new Date(2026, 10, 9, 21, 0))).toEqual([]);
  });
});

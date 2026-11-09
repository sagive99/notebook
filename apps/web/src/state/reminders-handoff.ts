import { compareIsoDates } from '@notebook/core';
import type { IsoDate, Item, NotebookDocument } from '@notebook/core';
import { safeStorage } from '../platform/safe-storage';

/**
 * iPhone Reminders handoff. A web app cannot write to Apple Reminders, so items marked
 * "Calendar + reminder" are handed to a Shortcut the user installs once ("Notebook Reminder"),
 * through a shortcuts:// link opened from the Save tap. One-way: the notebook never reads Reminders.
 * See docs/setup/iphone-reminders.md and ADR 0007.
 */
export const SHORTCUT_NAME = 'Notebook Reminder';
export const REMINDERS_ENABLED_KEY = 'notebook.reminders.shortcut';
export const REMINDERS_SENT_KEY = 'notebook.reminders.sent';
/** Alert time for a reminder item with a day but no time; matches the capture sheet's default. */
export const DEFAULT_REMINDER_TIME = '08:30';

export type ReminderPayload =
  | { action: 'add'; tag: string; title: string; due: string }
  | { action: 'remove'; tag: string };

export const remindersEnabled = (): boolean => safeStorage.get(REMINDERS_ENABLED_KEY) === '1';

export const setRemindersEnabled = (enabled: boolean): void => {
  safeStorage.set(REMINDERS_ENABLED_KEY, enabled ? '1' : '0');
};

/** The tag written into the reminder's notes; the Shortcut finds and replaces reminders by it. */
export const reminderTag = (itemId: string): string => `notebook:${itemId}`;

/** "2026-11-09 22:30": a form Shortcuts' "Get Dates from Input" reads in every locale. */
export const reminderDue = (item: Pick<Item, 'day' | 'time'>): string | null => (item.day ? `${item.day} ${item.time ?? DEFAULT_REMINDER_TIME}` : null);

export const shortcutUrl = (payload: ReminderPayload): string =>
  `shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT_NAME)}&input=text&text=${encodeURIComponent(JSON.stringify(payload))}`;

type SentMap = Record<string, string>;

const readSent = (): SentMap => {
  try {
    const parsed: unknown = JSON.parse(safeStorage.get(REMINDERS_SENT_KEY) ?? '{}');

    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  } catch {
    return {};
  }
};

const writeSent = (sent: SentMap): void => {
  safeStorage.set(REMINDERS_SENT_KEY, JSON.stringify(sent));
};

/** What the reminder for this item should be right now, or null when it should not exist. */
const wanted = (item: Item | undefined): { title: string; due: string } | null => {
  if (!item || item.deleted || item.done || !item.remind) {
    return null;
  }

  const due = reminderDue(item);
  const title = item.text.trim();

  return due && title ? { title, due } : null;
};

const signatureOf = (reminder: { title: string; due: string }): string => `${reminder.title}\n${reminder.due}`;

/**
 * Items whose Reminders copy is out of date on this phone: changed in Google Calendar or on another
 * device, or never sent. Only today and later count, so old reminders never nag.
 * Opening Shortcuts needs a tap, so the Today page offers these one at a time.
 */
export const staleReminders = (document: Pick<NotebookDocument, 'items'>, today: IsoDate): string[] => {
  if (!remindersEnabled()) {
    return [];
  }

  const sent = readSent();
  const stale = Object.values(document.items).filter((item) => {
    const next = wanted(item);

    if (next) {
      return compareIsoDates(item.day ?? today, today) >= 0 && sent[item.id] !== signatureOf(next);
    }

    return sent[item.id] !== undefined;
  });

  return stale.map((item) => item.id);
};

/**
 * Decides whether a save needs a trip to the Shortcut, and records what was sent on this phone.
 * Returns the shortcuts:// link to open, or null when the Reminders app is already up to date
 * (or the handoff is switched off). Call it with the item as it is after the save.
 */
export const reminderHandoff = (itemId: string, item: Item | undefined): string | null => {
  if (!remindersEnabled()) {
    return null;
  }

  const sent = readSent();
  const previous = sent[itemId];
  const next = wanted(item);
  const tag = reminderTag(itemId);

  if (next) {
    const signature = signatureOf(next);

    if (signature === previous) {
      return null;
    }

    writeSent({ ...sent, [itemId]: signature });

    return shortcutUrl({ action: 'add', tag, ...next });
  }

  if (previous === undefined) {
    return null;
  }

  writeSent(Object.fromEntries(Object.entries(sent).filter(([id]) => id !== itemId)));

  return shortcutUrl({ action: 'remove', tag });
};

/** A test reminder two minutes from now, for checking the Shortcut after setup. Not recorded. */
export const testReminderUrl = (now: Date): string => {
  const at = new Date(now.getTime() + 2 * 60_000);
  const pad = (value: number) => String(value).padStart(2, '0');
  const due = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;

  return shortcutUrl({ action: 'add', tag: 'notebook:test', title: 'Notebook test reminder', due });
};

/** Opens the Shortcut. Must run inside the tap that saved, or iOS may block the app switch. */
export const openShortcut = (url: string | null): void => {
  if (url) {
    window.location.href = url;
  }
};

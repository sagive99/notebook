import { addDays, toClockTime, toIsoDate } from './dates';
import type { ClockTime, IsoDate, Person } from './types';

export type CaptureTarget = 'today' | 'tomorrow';

export type ParsedCapture = {
  /** The text with #tags, day words and times removed; "@Name" stays as the plain name. */
  text: string;
  personId: string | null;
  day: IsoDate | null;
  time: ClockTime | null;
  tags: string[];
};

const TOMORROW_WORDS = ['tomorrow', 'tmrw', 'מחר'];
const TODAY_WORDS = ['today', 'tonight', 'היום', 'הערב'];

const isAfterCutoff = (now: Date, cutoff: ClockTime): boolean => toClockTime(now) >= cutoff;

/** Which day a capture defaults to: after the evening cutoff, thoughts are meant for tomorrow morning. */
export const defaultCaptureTarget = (now: Date, eveningCutoff: ClockTime): CaptureTarget => (isAfterCutoff(now, eveningCutoff) ? 'tomorrow' : 'today');

export const targetToDay = (target: CaptureTarget, now: Date): IsoDate => (target === 'tomorrow' ? addDays(toIsoDate(now), 1) : toIsoDate(now));

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

/** Matches "@Name" against people, preferring the longest name so "@Dana Levi" beats "@Dana". */
const findMention = (text: string, people: ReadonlyArray<Person>): { person: Person; token: string } | null => {
  const candidates = [...people].filter((person) => !person.deleted).sort((left, right) => right.name.length - left.name.length);

  for (const person of candidates) {
    const pattern = new RegExp(`(^|\\s)@${escapeRegExp(person.name)}(?=$|[\\s,.!?:;])`, 'iu');
    const match = pattern.exec(text);

    if (match) {
      return { person, token: match[0] };
    }
  }

  return null;
};

const removeToken = (text: string, token: string): string => text.replace(token, ' ');

const normaliseSpaces = (text: string): string => text.replace(/\s{2,}/gu, ' ').trim();

/**
 * Reads lightweight structure out of a quick capture: "@Omer" links a person, "#idea" adds a tag,
 * "tomorrow"/"מחר" or "today" picks the day, and "14:30" or "at 9" sets a time.
 * Day and time words are only read as such when they stand alone, so normal prose survives.
 */
export const parseCapture = (raw: string, people: ReadonlyArray<Person>, now: Date): ParsedCapture => {
  const mention = findMention(raw, people);
  const withoutMention = mention ? raw.replace(mention.token, mention.token.replace('@', '')) : raw;

  const tags: string[] = [];
  const withoutTags = withoutMention.replace(/(^|\s)#([\p{L}\p{N}_-]{1,32})/gu, (_match, lead: string, tag: string) => {
    tags.push(tag.toLowerCase());

    return lead;
  });

  const dayPattern = new RegExp(`(^|\\s)(${[...TOMORROW_WORDS, ...TODAY_WORDS].map(escapeRegExp).join('|')})(?=$|[\\s,.!?])`, 'iu');
  const dayMatch = dayPattern.exec(withoutTags);
  const dayWord = dayMatch?.[2]?.toLowerCase() ?? null;
  const day = dayWord === null ? null : TOMORROW_WORDS.includes(dayWord) ? addDays(toIsoDate(now), 1) : toIsoDate(now);
  const withoutDay = dayMatch ? removeToken(withoutTags, dayMatch[0]) : withoutTags;

  const timeMatch = /(^|\s)(?:at\s+|ב-?)?([01]?\d|2[0-3])(?::([0-5]\d))(?=$|[\s,.!?])/iu.exec(withoutDay) ?? /(^|\s)at\s+([01]?\d|2[0-3])(?=$|[\s,.!?])/iu.exec(withoutDay);
  const time = timeMatch ? `${(timeMatch[2] ?? '0').padStart(2, '0')}:${timeMatch[3] ?? '00'}` : null;
  const withoutTime = timeMatch ? removeToken(withoutDay, timeMatch[0]) : withoutDay;

  return {
    text: normaliseSpaces(withoutTime),
    personId: mention?.person.id ?? null,
    day,
    time,
    tags: [...new Set(tags)],
  };
};

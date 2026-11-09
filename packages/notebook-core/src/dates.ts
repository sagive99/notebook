import type { ClockTime, IsoDate } from './types';

const pad = (value: number): string => String(value).padStart(2, '0');

/** Formats a Date as a local-time calendar date. */
export const toIsoDate = (date: Date): IsoDate => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Parses YYYY-MM-DD as local midnight. */
export const fromIsoDate = (isoDate: IsoDate): Date => {
  const [year = 0, month = 1, day = 1] = isoDate.split('-').map(Number);

  return new Date(year, month - 1, day);
};

export const addDays = (isoDate: IsoDate, days: number): IsoDate => {
  const date = fromIsoDate(isoDate);
  date.setDate(date.getDate() + days);

  return toIsoDate(date);
};

export const toClockTime = (date: Date): ClockTime => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

/** Local Date for a calendar day at a wall-clock time. */
export const atClockTime = (isoDate: IsoDate, time: ClockTime): Date => {
  const date = fromIsoDate(isoDate);
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  date.setHours(hours, minutes, 0, 0);

  return date;
};

/** The seven ISO dates of the week containing the given day; weeks start on Sunday (0) by default, as in Israel. */
export const weekOf = (isoDate: IsoDate, weekStartsOn: 0 | 1 = 0): IsoDate[] => {
  const date = fromIsoDate(isoDate);
  const offset = (date.getDay() - weekStartsOn + 7) % 7;
  const start = addDays(isoDate, -offset);

  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
};

export const compareIsoDates = (left: IsoDate, right: IsoDate): number => (left < right ? -1 : left > right ? 1 : 0);

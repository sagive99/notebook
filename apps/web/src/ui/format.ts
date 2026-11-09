import { addDays, fromIsoDate } from '@notebook/core';
import type { IsoDate, SpaceColor } from '@notebook/core';

const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long' });
const shortWeekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });
const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' });

export const formatWeekday = (day: IsoDate): string => weekday.format(fromIsoDate(day));
export const formatDayMonth = (day: IsoDate): string => dayMonth.format(fromIsoDate(day));
export const weekdayLetter = (day: IsoDate): string => shortWeekday.format(fromIsoDate(day)).charAt(0);
export const dayNumber = (day: IsoDate): string => String(fromIsoDate(day).getDate());

/** "Today", "Tomorrow", "Yesterday", or a short weekday with date. */
export const relativeDay = (day: IsoDate, today: IsoDate): string => {
  if (day === today) {
    return 'Today';
  }

  if (day === addDays(today, 1)) {
    return 'Tomorrow';
  }

  if (day === addDays(today, -1)) {
    return 'Yesterday';
  }

  return `${shortWeekday.format(fromIsoDate(day))} ${dayNumber(day)}`;
};

export const SPACE_COLORS: Record<SpaceColor, { bg: string; fg: string; swatch: string }> = {
  teal: { bg: '#E6F4F1', fg: '#0F6B5E', swatch: '#0F7B6C' },
  blue: { bg: '#EEF1FD', fg: '#2F4FD0', swatch: '#2F4FD0' },
  orange: { bg: '#FDF1E3', fg: '#9A5B13', swatch: '#C2410C' },
  purple: { bg: '#F1EEF8', fg: '#5B3FA0', swatch: '#5B3FA0' },
  rose: { bg: '#FCEBF1', fg: '#A3204F', swatch: '#B4235A' },
  slate: { bg: '#F3F2EE', fg: '#4A4C55', swatch: '#4A4C55' },
};

export const initials = (name: string): string => name.trim().split(/\s+/u).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || '?';

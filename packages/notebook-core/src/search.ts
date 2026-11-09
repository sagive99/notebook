import { addDays, compareIsoDates, toIsoDate } from './dates';
import { isOngoing, liveItems, livePeople, liveSpaces } from './selectors';
import type { IsoDate, Item, NotebookDocument, Person, Space } from './types';

/** A person hit, with the ongoing task to show under the name (the matching one when the match came from it). */
export type PersonHit = { person: Person; ongoing: Item | null };

export type SearchGroups = {
  tasks: Item[];
  notes: Item[];
  ideas: Item[];
  people: PersonHit[];
  spaces: Space[];
};

export type SearchType = keyof SearchGroups;

export const SEARCH_TYPES: ReadonlyArray<SearchType> = ['tasks', 'notes', 'ideas', 'people', 'spaces'];

const KIND_GROUP: Record<Item['kind'], 'tasks' | 'notes' | 'ideas'> = { task: 'tasks', note: 'notes', idea: 'ideas' };

/** Open, ongoing items first, then open items, then finished ones; newest edits first within each. */
const newestFirst = (left: string, right: string): number => (left === right ? 0 : left < right ? 1 : -1);

const relevance = (left: Item, right: Item): number => Number(isOngoing(right)) - Number(isOngoing(left)) || Number(left.done) - Number(right.done) || newestFirst(left.updatedAt, right.updatedAt);

/** Everything matching the query, grouped by type. People also match on their ongoing tasks. */
export const searchNotebook = (document: NotebookDocument, query: string, limitPerGroup = 30): SearchGroups => {
  const needle = query.trim().toLocaleLowerCase();
  const empty: SearchGroups = { tasks: [], notes: [], ideas: [], people: [], spaces: [] };

  if (needle === '') {
    return empty;
  }

  const matches = (value: string): boolean => value.toLocaleLowerCase().includes(needle);
  const all = liveItems(document);
  const items = all.filter((item) => matches(item.text) || item.tags.some(matches)).sort(relevance);
  const ongoingByPerson = new Map<string, Item[]>();
  all.filter((item) => isOngoing(item) && item.personId !== null).sort((left, right) => (left.ongoingSince ?? '').localeCompare(right.ongoingSince ?? '')).forEach((item) => ongoingByPerson.set(item.personId ?? '', [...(ongoingByPerson.get(item.personId ?? '') ?? []), item]));
  const personHit = (person: Person): PersonHit | null => {
    const ongoing = ongoingByPerson.get(person.id) ?? [];
    const matching = ongoing.find((item) => matches(item.text));

    return matches(person.name) || matches(person.notes) || matching ? { person, ongoing: matching ?? ongoing[0] ?? null } : null;
  };

  return {
    tasks: items.filter((item) => KIND_GROUP[item.kind] === 'tasks').slice(0, limitPerGroup),
    notes: items.filter((item) => KIND_GROUP[item.kind] === 'notes').slice(0, limitPerGroup),
    ideas: items.filter((item) => KIND_GROUP[item.kind] === 'ideas').slice(0, limitPerGroup),
    people: livePeople(document).map(personHit).filter((hit): hit is PersonHit => hit !== null).slice(0, limitPerGroup),
    spaces: liveSpaces(document).filter((space) => matches(space.name)).slice(0, limitPerGroup),
  };
};

export type QuickFilterId = 'ongoing' | 'waiting' | 'due-today' | 'carried' | 'reminders' | 'done-week';

export const QUICK_FILTERS: ReadonlyArray<{ id: QuickFilterId; label: string }> = [
  { id: 'ongoing', label: 'Ongoing' },
  { id: 'waiting', label: 'Waiting on people' },
  { id: 'due-today', label: 'Due today' },
  { id: 'carried', label: 'Carried over' },
  { id: 'reminders', label: 'Reminders' },
  { id: 'done-week', label: 'Done this week' },
];

/** Items behind a quick filter. "This week" means the last seven days, today included. */
export const quickFilterItems = (document: NotebookDocument, id: QuickFilterId, today: IsoDate): Item[] => {
  const items = liveItems(document);
  const openTask = (item: Item): boolean => item.kind === 'task' && !item.done;
  const weekStart = addDays(today, -6);

  switch (id) {
    case 'ongoing':
      return items.filter(isOngoing).sort((left, right) => (left.ongoingSince ?? '').localeCompare(right.ongoingSince ?? ''));
    case 'waiting':
      return items.filter((item) => openTask(item) && item.personId !== null).sort(relevance);
    case 'due-today':
      return items.filter((item) => !item.done && item.day === today).sort(relevance);
    case 'carried':
      return items.filter((item) => openTask(item) && item.day !== null && compareIsoDates(item.day, today) < 0).sort((left, right) => compareIsoDates(left.day ?? '', right.day ?? ''));
    case 'reminders':
      return items.filter((item) => item.remind && !item.done && item.day !== null && compareIsoDates(item.day, today) >= 0).sort((left, right) => compareIsoDates(left.day ?? '', right.day ?? '') || (left.time ?? '').localeCompare(right.time ?? ''));
    case 'done-week':
      return items.filter((item) => item.done && item.doneAt !== null && toIsoDate(new Date(item.doneAt)) >= weekStart).sort((left, right) => newestFirst(left.doneAt ?? '', right.doneAt ?? ''));
  }
};

/** Splits text into plain and matching parts (case-insensitive) so the UI can highlight matches as text. */
export const highlightParts = (text: string, query: string): Array<{ text: string; match: boolean }> => {
  const needle = query.trim().toLocaleLowerCase();

  if (needle === '') {
    return [{ text, match: false }];
  }

  const lower = text.toLocaleLowerCase();
  const parts: Array<{ text: string; match: boolean }> = [];
  const state = { from: 0 };

  for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, at + needle.length)) {
    if (at > state.from) {
      parts.push({ text: text.slice(state.from, at), match: false });
    }

    parts.push({ text: text.slice(at, at + needle.length), match: true });
    state.from = at + needle.length;
  }

  if (state.from < text.length) {
    parts.push({ text: text.slice(state.from), match: false });
  }

  return parts;
};

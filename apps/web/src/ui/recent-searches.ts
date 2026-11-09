import { safeStorage } from '../platform/safe-storage';

const KEY = 'notebook.search.recent';
const LIMIT = 5;

/** Recent search queries for this device, newest first. A convenience only, so it never syncs. */
export const readRecentSearches = (): string[] => {
  try {
    const parsed: unknown = JSON.parse(safeStorage.get(KEY) ?? '[]');

    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string').slice(0, LIMIT) : [];
  } catch {
    return [];
  }
};

export const rememberSearch = (query: string): string[] => {
  const trimmed = query.trim();

  if (trimmed.length < 2) {
    return readRecentSearches();
  }

  const next = [trimmed, ...readRecentSearches().filter((entry) => entry.toLocaleLowerCase() !== trimmed.toLocaleLowerCase())].slice(0, LIMIT);
  safeStorage.set(KEY, JSON.stringify(next));

  return next;
};

export const clearRecentSearches = (): void => safeStorage.remove(KEY);

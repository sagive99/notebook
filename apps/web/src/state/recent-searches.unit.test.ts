import { beforeEach, describe, expect, it } from 'vitest';
import { clearRecentSearches, readRecentSearches, rememberSearch } from './recent-searches';

describe('recent searches', () => {
  beforeEach(() => localStorage.clear());

  it('keeps the five newest distinct queries, newest first', () => {
    ['deploy', 'SSE', 'a', 'Deploy', 'team', 'noa', 'ideas', 'map'].forEach(rememberSearch);

    expect(readRecentSearches()).toEqual(['map', 'ideas', 'noa', 'team', 'Deploy']);

    clearRecentSearches();

    expect(readRecentSearches()).toEqual([]);
  });

  it('ignores corrupted storage', () => {
    localStorage.setItem('notebook.search.recent', '{"not":"a list"}');

    expect(readRecentSearches()).toEqual([]);
  });
});

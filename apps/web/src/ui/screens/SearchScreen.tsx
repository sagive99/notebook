import { QUICK_FILTERS, SEARCH_TYPES, isOngoing, livePeople, quickFilterItems, searchNotebook } from '@notebook/core';
import type { QuickFilterId, SearchType } from '@notebook/core';
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { useNotebook, useToday } from '../../state/hooks';
import { clearRecentSearches, readRecentSearches, rememberSearch } from '../../state/recent-searches';
import { Highlighted, ItemRow } from '../components/ItemRow';
import { Empty } from '../components/primitives';
import { SPACE_COLORS, initials, personTone } from '../format';
import { ChevronLeftIcon, ChevronRightIcon, ClockIcon, CloseIcon, SearchIcon } from '../icons';
import { href } from '../router';
import { useSheets } from '../sheets/sheet-context';

type TypeFilter = 'all' | SearchType;

const TYPE_LABEL: Record<SearchType, string> = { tasks: 'Tasks', notes: 'Notes', ideas: 'Ideas', people: 'People', spaces: 'Spaces' };

const QUICK_TONE: Record<QuickFilterId, { bg: string; fg: string }> = {
  ongoing: { bg: '#EEF1FD', fg: '#2F4FD0' },
  waiting: { bg: '#FDF1E3', fg: '#9A5B13' },
  'due-today': { bg: '#E6F4F1', fg: '#0F6B5E' },
  carried: { bg: '#FCEBF1', fg: '#A3204F' },
  reminders: { bg: '#F1EEF8', fg: '#5B3FA0' },
  'done-week': { bg: '#F3F2EE', fg: '#4A4C55' },
};

const SEARCH_DELAY_MS = 120;

const Section = ({ title, count, children }: { title: string; count: number; children: ComponentChildren }) => (
  <section class="card search-section">
    <h2 class="card__title">{title} · {count}</h2>
    <div class="item-list">{children}</div>
  </section>
);

export const SearchScreen = () => {
  const { document } = useNotebook();
  const today = useToday();
  const sheets = useSheets();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<TypeFilter>('all');
  const [quick, setQuick] = useState<QuickFilterId | null>(null);
  const [recent, setRecent] = useState(readRecentSearches);
  const [settled, setSettled] = useState('');
  const searching = query.trim() !== '';

  // Search the whole notebook only once typing pauses briefly, not on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setSettled(query), query.trim() === '' ? 0 : SEARCH_DELAY_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const groups = useMemo(() => searchNotebook(document, settled), [document, settled]);
  const quickCounts = useMemo(() => new Map(QUICK_FILTERS.map((filter) => [filter.id, quickFilterItems(document, filter.id, today).length])), [document, today]);
  const ongoingPeople = useMemo(() => new Set(Object.values(document.items).filter((item) => !item.deleted && item.personId !== null && isOngoing(item)).map((item) => item.personId)), [document]);
  const counts: Record<SearchType, number> = { tasks: groups.tasks.length, notes: groups.notes.length, ideas: groups.ideas.length, people: groups.people.length, spaces: groups.spaces.length };
  const total = SEARCH_TYPES.reduce((sum, key) => sum + counts[key], 0);
  const remember = () => setRecent(rememberSearch(query));
  const visible = (key: SearchType) => (type === 'all' || type === key) && counts[key] > 0;

  if (quick) {
    const filter = QUICK_FILTERS.find((entry) => entry.id === quick);
    const items = quickFilterItems(document, quick, today);

    return (
      <div class="screen">
        <header class="screen-header">
          <button type="button" class="back-link back-link--button" onClick={() => setQuick(null)}><ChevronLeftIcon size={16} /> Search</button>
          <h1 class="screen-header__title">{filter?.label} <span class="screen-header__count">{items.length}</span></h1>
        </header>
        {items.length === 0 ? <Empty>Nothing here right now.</Empty> : <section class="card"><div class="item-list">{items.map((item) => <ItemRow key={item.id} item={item} today={today} showDay showSpace />)}</div></section>}
      </div>
    );
  }

  return (
    <div class="screen">
      <header class="screen-header">
        <h1 class="screen-header__title">Search</h1>
      </header>
      <form class="search-field" role="search" onSubmit={(event) => {
        event.preventDefault();
        remember();
      }}>
        <SearchIcon size={20} />
        <input type="search" dir="auto" enterKeyHint="search" aria-label="Search everything" placeholder="Tasks, notes, people, spaces" value={query} onInput={(event) => setQuery(event.currentTarget.value)} onBlur={remember} />
        {searching ? <button type="button" class="search-field__clear" aria-label="Clear search" onClick={() => setQuery('')}><CloseIcon size={12} /></button> : null}
      </form>

      <div class="chip-row chip-row--scroll search-types" role="group" aria-label="Filter by type">
        <button type="button" class={`chip ${type === 'all' ? 'chip--selected' : ''}`} aria-pressed={type === 'all'} onClick={() => setType('all')}>All{searching ? ` · ${total}` : ''}</button>
        {SEARCH_TYPES.map((key) => <button key={key} type="button" class={`chip ${type === key ? 'chip--selected' : ''}`} aria-pressed={type === key} onClick={() => setType(key)}>{TYPE_LABEL[key]}{searching ? ` · ${counts[key]}` : ''}</button>)}
      </div>

      {searching ? (
        <div class="stack">
          {settled === query && (total === 0 || SEARCH_TYPES.every((key) => !visible(key))) ? <Empty>Nothing matches “{query.trim()}”{type === 'all' ? '' : ` in ${TYPE_LABEL[type].toLowerCase()}`}.</Empty> : null}
          {(['tasks', 'notes', 'ideas'] as const).filter(visible).map((key) => (
            <Section key={key} title={TYPE_LABEL[key]} count={counts[key]}>
              {groups[key].map((item) => <ItemRow key={item.id} item={item} today={today} showDay showSpace highlight={settled} onOpen={remember} />)}
            </Section>
          ))}
          {visible('people') ? (
            <Section title="People" count={counts.people}>
              {groups.people.map(({ person, ongoing }) => (
                  <button key={person.id} type="button" class="search-hit" onClick={() => {
                    remember();
                    sheets.open({ kind: 'person', id: person.id });
                  }}>
                    <span class="avatar avatar--small" aria-hidden="true">{initials(person.name)}</span>
                    <span class="search-hit__body"><span class="search-hit__title" dir="auto"><Highlighted text={person.name} query={settled} /></span>{ongoing ? <span class="search-hit__meta" dir="auto">Ongoing: <Highlighted text={ongoing.text} query={settled} /></span> : null}</span>
                    <ChevronRightIcon size={16} />
                  </button>
              ))}
            </Section>
          ) : null}
          {visible('spaces') ? (
            <Section title="Spaces" count={counts.spaces}>
              {groups.spaces.map((space) => (
                <a key={space.id} class="search-hit" href={href({ name: 'space', id: space.id })} onClick={remember}>
                  <span class="space-mark space-mark--small" style={{ background: SPACE_COLORS[space.color].bg, color: SPACE_COLORS[space.color].fg }} aria-hidden="true">{initials(space.name).charAt(0)}</span>
                  <span class="search-hit__body"><span class="search-hit__title" dir="auto"><Highlighted text={space.name} query={settled} /></span></span>
                  <ChevronRightIcon size={16} />
                </a>
              ))}
            </Section>
          ) : null}
        </div>
      ) : (
        <div class="stack stack--loose">
          <div class="field">
            <span class="section-label">Quick filters</span>
            <div class="quick-grid">
              {QUICK_FILTERS.map((filter) => (
                <button key={filter.id} type="button" class="quick-tile" onClick={() => setQuick(filter.id)}>
                  <span class="quick-tile__count" style={{ background: QUICK_TONE[filter.id].bg, color: QUICK_TONE[filter.id].fg }}>{quickCounts.get(filter.id) ?? 0}</span>
                  <span class="quick-tile__label">{filter.label}</span>
                </button>
              ))}
            </div>
          </div>
          {livePeople(document).length > 0 ? (
            <div class="field">
              <span class="section-label">People</span>
              <div class="people-row">
                {livePeople(document).map((person, index) => {
                  const tone = personTone(person, index);
                  const ongoing = ongoingPeople.has(person.id);

                  return (
                    <button key={person.id} type="button" class="people-row__person" aria-label={`${person.name}${ongoing ? ', has ongoing work' : ''}`} onClick={() => sheets.open({ kind: 'person', id: person.id })}>
                      <span class={`avatar avatar--large ${ongoing ? 'avatar--ongoing' : ''}`} style={{ background: tone?.bg, color: tone?.fg }} aria-hidden="true">{initials(person.name)}</span>
                      <span class="people-row__name" dir="auto">{person.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {recent.length > 0 ? (
            <div class="field">
              <div class="field__head"><span class="section-label">Recent</span><button type="button" class="link-button" onClick={() => {
                clearRecentSearches();
                setRecent([]);
              }}>Clear</button></div>
              <ul class="recent-list">
                {recent.map((entry) => (
                  <li key={entry}><button type="button" class="recent-list__item" onClick={() => setQuery(entry)}><ClockIcon size={16} /><span dir="auto">{entry}</span></button></li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

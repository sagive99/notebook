import { describe, expect, it } from 'vitest';
import { addItem, addPerson, createDocument, placeItemBefore, setItemOngoing, toggleItemDone, updatePerson } from './document';
import { mergeDocuments } from './merge';
import { moveTaskOnPeopleBoard, resolveLegacyNow } from './people';
import { dayPage } from './selectors';
import { parseDocument } from './merge';
import { personTasks } from './selectors';
import { testContext } from './test-support';

const fixture = () => {
  const context = testContext();
  const withPerson = addPerson(createDocument(context), 'Dana', context);
  const ids: string[] = [];
  const document = ['CR for the SSE PR', 'Map layers ADR', 'Onboarding doc'].reduce((current, text) => {
    const added = addItem(current, { kind: 'task', text, personId: withPerson.person.id }, context);
    ids.push(added.item.id);

    return added.document;
  }, withPerson.document);

  return { context, person: withPerson.person, document, ids };
};

const texts = (items: ReadonlyArray<{ text: string }>) => items.map((item) => item.text);

describe('ongoing tasks', () => {
  it('moves a task into the ongoing group and back', () => {
    const { context, person, document, ids } = fixture();
    const started = setItemOngoing(document, ids[1] ?? '', true, context);

    expect(texts(personTasks(started, person).ongoing)).toEqual(['Map layers ADR']);
    expect(texts(personTasks(started, person).next)).toEqual(['CR for the SSE PR', 'Onboarding doc']);

    const stopped = setItemOngoing(started, ids[1] ?? '', false, context);

    expect(personTasks(stopped, person).ongoing).toEqual([]);
    expect(setItemOngoing(stopped, ids[1] ?? '', false, context)).toBe(stopped);
  });

  it('keeps a task finished during this visit in place, then drops it', () => {
    const { context, person, document, ids } = fixture();
    const started = setItemOngoing(document, ids[0] ?? '', true, context);
    const finished = toggleItemDone(toggleItemDone(started, ids[2] ?? '', context), ids[0] ?? '', context);
    const visit = new Set([ids[0] ?? '', ids[2] ?? '']);

    expect(texts(personTasks(finished, person, visit).ongoing)).toEqual(['CR for the SSE PR']);
    expect(texts(personTasks(finished, person, visit).next)).toEqual(['Map layers ADR', 'Onboarding doc']);
    expect(texts(personTasks(finished, person).ongoing)).toEqual([]);
    expect(texts(personTasks(finished, person).next)).toEqual(['Map layers ADR']);

    const undone = toggleItemDone(finished, ids[0] ?? '', context);

    expect(texts(personTasks(undone, person).ongoing)).toEqual(['CR for the SSE PR']);
  });

  it('reorders tasks by placing one before another', () => {
    const { context, person, document, ids } = fixture();
    const siblings = personTasks(document, person).next;
    const moved = placeItemBefore(document, ids[2] ?? '', ids[0] ?? '', siblings, context);

    expect(texts(personTasks(moved, person).next)).toEqual(['Onboarding doc', 'CR for the SSE PR', 'Map layers ADR']);

    const last = placeItemBefore(moved, ids[2] ?? '', null, personTasks(moved, person).next, context);

    expect(texts(personTasks(last, person).next)).toEqual(['CR for the SSE PR', 'Map layers ADR', 'Onboarding doc']);
  });

  it('reads items stored before ongoingSince existed', () => {
    const { document } = fixture();
    const raw = JSON.parse(JSON.stringify(document)) as { items: Record<string, Record<string, unknown>> };
    Object.values(raw.items).forEach((item) => {
      delete item.ongoingSince;
    });
    const parsed = parseDocument(raw);

    expect(parsed.ok && Object.values(parsed.document.items).every((item) => item.ongoingSince === null)).toBe(true);
  });
});

describe('moveTaskOnPeopleBoard', () => {
  it('starts a task dropped on ongoing, and stops and places one dropped in up next', () => {
    const { context, person, document, ids } = fixture();
    const started = moveTaskOnPeopleBoard(document, ids[2] ?? '', { zone: 'ongoing', beforeId: null }, context);

    expect(texts(personTasks(started, person).ongoing)).toEqual(['Onboarding doc']);

    const back = moveTaskOnPeopleBoard(started, ids[2] ?? '', { zone: 'next', beforeId: ids[0] ?? '' }, context);

    expect(personTasks(back, person).ongoing).toEqual([]);
    expect(texts(personTasks(back, person).next)).toEqual(['Onboarding doc', 'CR for the SSE PR', 'Map layers ADR']);
  });
});

describe('placeItemBefore renumbering', () => {
  it('renumbers siblings when there is no gap left between neighbours', () => {
    const { context, person, document, ids } = fixture();
    const tied = [ids[0], ids[1]].reduce((current, id) => updateOrder(current, id ?? '', 5), document);
    const placed = placeItemBefore(tied, ids[2] ?? '', ids[1] ?? '', personTasks(tied, person).next, context);
    const next = personTasks(placed, person).next;

    expect(texts(next)).toEqual(['CR for the SSE PR', 'Onboarding doc', 'Map layers ADR']);
    expect(new Set(next.map((item) => item.order)).size).toBe(3);
  });
});

describe('legacy now line', () => {
  it('turns the old text into an ongoing task, or just clears it', () => {
    const { context, person, document } = fixture();
    const withNow = updatePerson(document, person.id, { now: 'Deploying map layers' }, context);
    const converted = resolveLegacyNow(withNow, person.id, true, context);

    expect(converted.people[person.id]?.now).toBe('');
    expect(texts(personTasks(converted, person).ongoing)).toEqual(['Deploying map layers']);
    expect(resolveLegacyNow(withNow, person.id, false, context).people[person.id]?.now).toBe('');
    expect(Object.keys(resolveLegacyNow(withNow, person.id, false, context).items)).toHaveLength(Object.keys(withNow.items).length);
  });
});

describe('older app versions', () => {
  it('falls back to up next when an older version saves an ongoing task without ongoingSince', () => {
    const { context, person, document, ids } = fixture();
    const started = setItemOngoing(document, ids[0] ?? '', true, context);
    const raw = JSON.parse(JSON.stringify(started)) as { items: Record<string, Record<string, unknown>> };
    const olderSave = raw.items[ids[0] ?? ''];

    if (olderSave) {
      delete olderSave.ongoingSince;
      olderSave.text = 'CR for the SSE PR (edited on old phone)';
      olderSave.updatedAt = '2030-01-01T00:00:00.000Z';
    }

    const parsed = parseDocument(raw);
    const merged = parsed.ok ? mergeDocuments(started, parsed.document) : started;

    expect(personTasks(merged, person).ongoing).toEqual([]);
    expect(texts(personTasks(merged, person).next)).toContain('CR for the SSE PR (edited on old phone)');
  });
});

describe('ongoing on Today', () => {
  it('lists ongoing tasks from any day (or none) first on today, not as carried', () => {
    const { context, document, ids } = fixture();
    const dated = addItem(document, { kind: 'task', text: 'Today task', day: '2026-11-09' }, context);
    const old = addItem(dated.document, { kind: 'task', text: 'Old ongoing', day: '2026-11-01' }, context);
    const started = setItemOngoing(setItemOngoing(old.document, ids[1] ?? '', true, context), old.item.id, true, context);
    const page = dayPage(started, '2026-11-09', '2026-11-09');

    expect(texts(page.open)).toEqual(['Map layers ADR', 'Old ongoing', 'Today task']);
    expect(page.carried).toEqual([]);
    expect(texts(dayPage(started, '2026-11-10', '2026-11-09').open)).toEqual([]);
  });
});

const updateOrder = (document: ReturnType<typeof createDocument>, id: string, order: number) => {
  const item = document.items[id];

  return item ? { ...document, items: { ...document.items, [id]: { ...item, order } } } : document;
};

import { describe, expect, it } from 'vitest';
import { addItem, addPerson, createDocument, placeItemBefore, setItemOngoing, toggleItemDone } from './document';
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

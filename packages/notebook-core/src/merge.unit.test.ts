import { describe, expect, it } from 'vitest';
import { addItem, addPerson, createDocument, deleteItem, updateItem } from './document';
import { mergeDocuments, parseDocument, pruneTombstones } from './merge';
import { testContext } from './test-support';

describe('mergeDocuments', () => {
  it('keeps the newest version of each entity and unions the rest', () => {
    const context = testContext();
    const base = addItem(createDocument(context), { kind: 'task', text: 'shared' }, context);
    context.advance(1);
    const phone = updateItem(base.document, base.item.id, { text: 'edited on phone' }, context);
    const phoneExtra = addItem(phone, { kind: 'note', text: 'phone only' }, context);
    const laptop = addItem(base.document, { kind: 'note', text: 'laptop only' }, context);

    const merged = mergeDocuments(laptop.document, phoneExtra.document);
    const texts = Object.values(merged.items).map((item) => item.text).sort();

    expect(texts).toEqual(['edited on phone', 'laptop only', 'phone only']);
  });

  it('propagates deletions and is commutative', () => {
    const context = testContext();
    const base = addItem(createDocument(context), { kind: 'task', text: 'gone' }, context);
    context.advance(1);
    const deleted = deleteItem(base.document, base.item.id, context);

    expect(mergeDocuments(base.document, deleted)).toEqual(mergeDocuments(deleted, base.document));
    expect(mergeDocuments(base.document, deleted).items[base.item.id]?.deleted).toBe(true);
  });
});

describe('pruneTombstones', () => {
  it('drops only tombstones older than 30 days', () => {
    const context = testContext('2026-10-01T09:00:00');
    const old = addItem(createDocument(context), { kind: 'task', text: 'old' }, context);
    const deleted = deleteItem(old.document, old.item.id, context);

    expect(pruneTombstones(deleted, new Date('2026-10-20T09:00:00')).items[old.item.id]).toBeDefined();
    expect(pruneTombstones(deleted, new Date('2026-11-09T09:00:00')).items[old.item.id]).toBeUndefined();
  });
});

describe('schema evolution', () => {
  it('reads v1 people written before the blocked flag existed', () => {
    const context = testContext();
    const document = JSON.parse(JSON.stringify(addPerson(createDocument(context), 'Noa', context).document)) as { people: Record<string, Record<string, unknown>> };
    Object.values(document.people).forEach((person) => {
      delete person.blocked;
    });
    const parsed = parseDocument(document);

    expect(parsed.ok && Object.values(parsed.document.people)[0]?.blocked).toBe(false);
  });
});

describe('parseDocument', () => {
  it('accepts a valid document and rejects malformed input', () => {
    const document = createDocument(testContext());

    expect(parseDocument(JSON.parse(JSON.stringify(document)))).toEqual({ ok: true, document });
    expect(parseDocument({ version: 1, items: { x: { id: 'x' } } }).ok).toBe(false);
    expect(parseDocument('nope').ok).toBe(false);
  });
});

import { addItem, createDocument, updateItem } from '@notebook/core';
import { afterEach, describe, expect, it } from 'vitest';
import { OfflineError } from '../adapters/google/http';
import { AuthRequiredError } from '../ports';
import { NotebookStore } from './notebook-store';
import { MemoryRemoteStore, memoryLocalStore, sequentialIds } from './test-fakes';

const clock = () => new Date('2026-11-09T09:00:00Z');

describe('NotebookStore', () => {
  const stores: NotebookStore[] = [];
  const make = (remote: MemoryRemoteStore | null, local = memoryLocalStore()) => {
    const store = new NotebookStore({ local, remote, clock, newId: sequentialIds(), syncDelayMs: 60_000 });
    stores.push(store);

    return { store, local };
  };

  afterEach(() => stores.splice(0).forEach((store) => store.dispose()));

  it('persists every change on the device immediately', () => {
    const { store, local } = make(null);

    store.run((document, context) => addItem(document, { kind: 'task', text: 'offline first' }, context).document);

    expect(Object.values(local.saved?.items ?? {}).map((item) => item.text)).toEqual(['offline first']);
    expect(store.getSnapshot().status).toEqual({ kind: 'local-only' });
  });

  it('uploads on first sync and merges edits from another device', async () => {
    const remote = new MemoryRemoteStore();
    const { store } = make(remote);
    store.setRemote(remote, { kind: 'pending' });
    store.run((document, context) => addItem(document, { kind: 'task', text: 'from phone' }, context).document);
    await store.sync();

    expect(remote.saves).toBe(1);

    const other = remote.stored?.document ?? createDocument({ now: clock(), newId: sequentialIds() });
    const fromLaptop = addItem(other, { kind: 'note', text: 'from laptop' }, { now: new Date('2026-11-09T09:05:00Z'), newId: () => 'laptop-1' }).document;
    remote.writeExternally(fromLaptop);
    await store.sync();

    const texts = Object.values(store.getSnapshot().document.items).map((item) => item.text).sort();

    expect(texts).toEqual(['from laptop', 'from phone']);
    expect(store.getSnapshot().status.kind).toBe('synced');
  });

  it('retries when another device writes between load and save', async () => {
    const remote = new MemoryRemoteStore();
    const { store } = make(remote);
    store.setRemote(remote, { kind: 'pending' });
    await store.sync();
    const base = remote.stored?.document;
    store.run((document, context) => addItem(document, { kind: 'task', text: 'mine' }, context).document);
    remote.interleave = () => {
      if (base) {
        remote.writeExternally(addItem(base, { kind: 'task', text: 'theirs' }, { now: new Date('2026-11-09T09:01:00Z'), newId: () => 'x-1' }).document);
      }
    };

    await store.sync();

    const stored = Object.values(remote.stored?.document.items ?? {}).map((item) => item.text).sort();

    expect(stored).toEqual(['mine', 'theirs']);
    expect(store.getSnapshot().status.kind).toBe('synced');
  });

  it('reports reconnect and offline states without losing local data', async () => {
    const remote = new MemoryRemoteStore();
    const { store, local } = make(remote);
    store.setRemote(remote, { kind: 'pending' });
    store.run((document, context) => addItem(document, { kind: 'task', text: 'keep me' }, context).document);

    remote.failNext = new AuthRequiredError();
    await store.sync();

    expect(store.getSnapshot().status.kind).toBe('needs-auth');

    remote.failNext = new OfflineError();
    await store.sync();

    expect(store.getSnapshot().status.kind).toBe('offline');
    expect(Object.values(local.saved?.items ?? {}).some((item) => item.text === 'keep me')).toBe(true);
  });

  it('keeps edits made while a sync is in flight', async () => {
    const remote = new MemoryRemoteStore();
    const { store } = make(remote);
    store.setRemote(remote, { kind: 'pending' });
    const added = store.run((document, context) => addItem(document, { kind: 'task', text: 'first' }, context).document);
    const id = Object.keys(added.items).find((key) => added.items[key]?.text === 'first') ?? '';

    const syncing = store.sync();
    store.run((document, context) => updateItem(document, id, { text: 'edited mid-sync' }, { ...context, now: new Date('2026-11-09T09:00:01Z') }));
    await syncing;

    expect(store.getSnapshot().document.items[id]?.text).toBe('edited mid-sync');
  });
});

import { parseDocument } from '@notebook/core';
import type { NotebookDocument } from '@notebook/core';
import type { LocalDocumentStore } from '../ports';
import { safeStorage } from './safe-storage';

const KEY = 'notebook.document.v1';

/** The device copy of the notebook in localStorage, validated on read like any stored data. */
export const createLocalStore = (key = KEY): LocalDocumentStore => ({
  load: () => {
    const raw = safeStorage.get(key);

    if (raw === null) {
      return null;
    }

    try {
      const parsed = parseDocument(JSON.parse(raw));

      return parsed.ok ? parsed.document : null;
    } catch {
      return null;
    }
  },
  save: (document: NotebookDocument) => {
    safeStorage.set(key, JSON.stringify(document));
  },
  clear: () => safeStorage.remove(key),
});

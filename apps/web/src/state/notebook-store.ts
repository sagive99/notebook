import { createDocument, mergeDocuments, pruneTombstones } from '@notebook/core';
import type { CommandContext, NotebookDocument } from '@notebook/core';
import { AuthRequiredError, ConflictError, OfflineError } from '../ports';
import type { LocalDocumentStore, RemoteDocumentStore } from '../ports';

export type SyncStatus =
  | { kind: 'local-only' }
  | { kind: 'signed-out' }
  | { kind: 'needs-auth'; message: string }
  | { kind: 'syncing' }
  | { kind: 'pending' }
  | { kind: 'synced'; at: number }
  | { kind: 'offline' }
  | { kind: 'error'; message: string };

export type StoreSnapshot = {
  document: NotebookDocument;
  status: SyncStatus;
};

export type Command = (document: NotebookDocument, context: CommandContext) => NotebookDocument;

export type ChangeSource = 'local' | 'remote';

export type ChangeListener = (before: NotebookDocument, after: NotebookDocument, source: ChangeSource) => void;

type StoreOptions = {
  local: LocalDocumentStore;
  remote: RemoteDocumentStore | null;
  clock?: () => Date;
  newId?: () => string;
  syncDelayMs?: number;
};

const MAX_CONFLICT_RETRIES = 3;

const sameDocument = (left: NotebookDocument, right: NotebookDocument): boolean => JSON.stringify(left) === JSON.stringify(right);

/**
 * Owns the notebook document: applies domain commands, persists every change on the device first,
 * and reconciles with remote storage by merging (see ADR 0003). Readers subscribe to snapshots.
 */
export class NotebookStore {
  private document: NotebookDocument;
  private status: SyncStatus;
  private snapshot: StoreSnapshot;
  private remoteVersion: string | null = null;
  /** Bumped on every local change; compared with `syncedRevision` to know whether anything awaits upload. */
  private revision = 0;
  private syncedRevision = -1;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private syncing: Promise<void> | null = null;
  private resyncRequested = false;
  private remote: RemoteDocumentStore | null;
  private readonly listeners = new Set<() => void>();
  private readonly changeListeners = new Set<ChangeListener>();
  private readonly local: LocalDocumentStore;
  private readonly clock: () => Date;
  private readonly newId: () => string;
  private readonly syncDelayMs: number;

  constructor(options: StoreOptions) {
    this.local = options.local;
    this.remote = options.remote;
    this.clock = options.clock ?? (() => new Date());
    this.newId = options.newId ?? (() => crypto.randomUUID());
    this.syncDelayMs = options.syncDelayMs ?? 1500;

    const stored = this.local.load();
    this.document = stored ?? createDocument(this.context());
    this.status = this.remote ? { kind: 'signed-out' } : { kind: 'local-only' };
    this.snapshot = { document: this.document, status: this.status };

    if (!stored) {
      this.local.save(this.document);
    }
  }

  context(): CommandContext {
    return { now: this.clock(), newId: this.newId };
  }

  getSnapshot = (): StoreSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);

    return () => this.listeners.delete(listener);
  };

  /** Notified after every change, local or merged in from another device, with the documents before and after it. */
  onChange(listener: ChangeListener): () => void {
    this.changeListeners.add(listener);

    return () => this.changeListeners.delete(listener);
  }

  run(command: Command): NotebookDocument {
    const before = this.document;
    const after = command(before, this.context());

    if (after === before) {
      return after;
    }

    this.document = after;
    this.revision += 1;
    this.local.save(after);

    if (this.remote && this.status.kind !== 'needs-auth' && this.status.kind !== 'signed-out') {
      this.setStatus({ kind: 'pending' });
      this.scheduleSync();
    } else {
      this.publish();
    }

    this.changeListeners.forEach((listener) => listener(before, after, 'local'));

    return after;
  }

  /** Enables or disables remote sync, e.g. after sign-in or sign-out. */
  setRemote(remote: RemoteDocumentStore | null, status: SyncStatus): void {
    this.remote = remote;
    this.remoteVersion = null;
    this.syncedRevision = -1;
    this.setStatus(status);
  }

  markNeedsAuth(message: string): void {
    this.setStatus({ kind: 'needs-auth', message });
  }

  scheduleSync(delayMs = this.syncDelayMs): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      void this.sync();
    }, delayMs);
  }

  /** Pulls, merges, and pushes. Concurrent calls coalesce into one follow-up run. */
  async sync(): Promise<void> {
    if (!this.remote) {
      return;
    }

    if (this.syncing) {
      this.resyncRequested = true;

      return this.syncing;
    }

    this.syncing = this.syncOnce(this.remote).finally(() => {
      this.syncing = null;

      if (this.resyncRequested) {
        this.resyncRequested = false;
        void this.sync();
      }
    });

    return this.syncing;
  }

  dispose(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    this.listeners.clear();
    this.changeListeners.clear();
  }

  private async syncOnce(remote: RemoteDocumentStore): Promise<void> {
    this.setStatus({ kind: 'syncing' });
    const startRevision = this.revision;

    try {
      if (this.syncedRevision === startRevision && this.remoteVersion !== null && (await remote.version()) === this.remoteVersion) {
        this.setStatus({ kind: 'synced', at: Date.now() });

        return;
      }

      for (let attempt = 0; attempt < MAX_CONFLICT_RETRIES; attempt += 1) {
        const stored = await remote.load();
        const merged = pruneTombstones(stored ? mergeDocuments(stored.document, this.document) : this.document, this.clock());
        this.remoteVersion = stored?.version ?? null;

        try {
          if (!stored || !sameDocument(stored.document, merged)) {
            const saved = await remote.save(merged, this.remoteVersion);
            this.remoteVersion = saved.version;
          }

          this.syncedRevision = startRevision;
          const editedMeanwhile = this.adoptMerged(merged);

          if (editedMeanwhile) {
            this.setStatus({ kind: 'pending' });
            this.scheduleSync();

            return;
          }

          this.setStatus({ kind: 'synced', at: Date.now() });

          return;
        } catch (error) {
          if (!(error instanceof ConflictError)) {
            throw error;
          }
        }
      }

      throw new Error('Another device kept changing the notebook. Will retry shortly.');
    } catch (error) {
      this.setStatus(this.statusForError(error));
    }
  }

  /**
   * Takes the merged result while keeping edits made during the round-trip, pruned like the upload.
   * Returns true when such edits exist and still need uploading.
   */
  private adoptMerged(merged: NotebookDocument): boolean {
    const before = this.document;
    const next = pruneTombstones(mergeDocuments(merged, before), this.clock());
    const editedMeanwhile = this.revision !== this.syncedRevision;

    if (!sameDocument(next, before)) {
      this.document = next;
      this.local.save(next);
      this.changeListeners.forEach((listener) => listener(before, next, 'remote'));
    }

    return editedMeanwhile;
  }

  private statusForError(error: unknown): SyncStatus {
    if (error instanceof AuthRequiredError) {
      return { kind: 'needs-auth', message: error.message };
    }

    if (error instanceof OfflineError) {
      return { kind: 'offline' };
    }

    return { kind: 'error', message: error instanceof Error ? error.message : 'Sync failed.' };
  }

  private setStatus(status: SyncStatus): void {
    this.status = status;
    this.publish();
  }

  private publish(): void {
    this.snapshot = { document: this.document, status: this.status };
    this.listeners.forEach((listener) => listener());
  }
}

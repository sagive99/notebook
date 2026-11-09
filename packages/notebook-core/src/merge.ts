import { notebookDocumentSchema } from './schemas';
import type { NotebookDocument } from './types';

type Versioned = { updatedAt: string; deleted?: boolean };

const newer = <T extends Versioned>(left: T | undefined, right: T | undefined): T | undefined => {
  if (!left) {
    return right;
  }

  if (!right || left === right) {
    return left;
  }

  if (right.updatedAt !== left.updatedAt) {
    return right.updatedAt > left.updatedAt ? right : left;
  }

  return tieBreak(left, right);
};

/**
 * Equal timestamps: a deletion wins; then the copy with fewer empty (null) fields, because an older app version
 * re-saves entities without the fields it doesn't know and they come back as null; then a stable content order.
 * Every step is symmetric, so merge stays commutative.
 */
const tieBreak = <T extends Versioned>(left: T, right: T): T => {
  const leftDeleted = left.deleted === true;
  const rightDeleted = right.deleted === true;

  if (leftDeleted !== rightDeleted) {
    return leftDeleted ? left : right;
  }

  const leftEmpty = emptyFields(left);
  const rightEmpty = emptyFields(right);

  if (leftEmpty !== rightEmpty) {
    return leftEmpty < rightEmpty ? left : right;
  }

  return JSON.stringify(right) > JSON.stringify(left) ? right : left;
};

const emptyFields = (entity: object): number => Object.values(entity).filter((value) => value === null).length;

const mergeRecords = <T extends Versioned>(left: Record<string, T>, right: Record<string, T>): Record<string, T> => {
  const ids = new Set([...Object.keys(left), ...Object.keys(right)]);
  const merged: Record<string, T> = {};

  for (const id of ids) {
    const winner = newer(left[id], right[id]);

    if (winner) {
      merged[id] = winner;
    }
  }

  return merged;
};

/**
 * Merges two copies of the notebook entity by entity: the most recently updated version wins,
 * and tombstones win over older edits so deletions propagate. Merging is commutative and idempotent.
 */
export const mergeDocuments = (left: NotebookDocument, right: NotebookDocument): NotebookDocument => ({
  version: left.version,
  items: mergeRecords(left.items, right.items),
  people: mergeRecords(left.people, right.people),
  spaces: mergeRecords(left.spaces, right.spaces),
  settings: newer(left.settings, right.settings) ?? left.settings,
});

const TOMBSTONE_TTL_MS = 30 * 86_400_000;

const pruneRecord = <T extends Versioned & { deleted: boolean }>(record: Record<string, T>, cutoff: string): Record<string, T> => Object.fromEntries(Object.entries(record).filter(([, value]) => !value.deleted || value.updatedAt >= cutoff));

/** Drops tombstones older than 30 days; every device has synced by then in practice. */
export const pruneTombstones = (document: NotebookDocument, now: Date): NotebookDocument => {
  const cutoff = new Date(now.getTime() - TOMBSTONE_TTL_MS).toISOString();

  return {
    ...document,
    items: pruneRecord(document.items, cutoff),
    people: pruneRecord(document.people, cutoff),
    spaces: pruneRecord(document.spaces, cutoff),
  };
};

export type ParseResult = { ok: true; document: NotebookDocument } | { ok: false; error: string };

/** Validates an untrusted stored document (Drive file or local cache) before domain use. */
export const parseDocument = (raw: unknown): ParseResult => {
  const result = notebookDocumentSchema.safeParse(raw);

  if (!result.success) {
    return { ok: false, error: result.error.issues.slice(0, 3).map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ') };
  }

  return { ok: true, document: result.data };
};

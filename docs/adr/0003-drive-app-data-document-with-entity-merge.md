---
status: accepted
date: 2026-11-09
scope:
  - storage
  - sync
  - "@notebook/core"
  - "@notebook/web"
supersedes: []
---

# 0003: Drive app-data document with entity merge

## Context

With no server (ADR 0002), the notebook needs durable storage that syncs between the phone and other devices, survives iOS clearing web storage, and works offline. The owner chose Google Drive over Supabase or device-only storage. Data volume is small: hundreds to low thousands of items.

## Decision

- The whole notebook is one JSON document (`notebookDocumentSchema` in `@notebook/core`), stored:
  - on the device in `localStorage`, written synchronously on every change; and
  - in Google Drive as `notebook.json` in the hidden `appDataFolder`, scope `drive.appdata`.
- Every entity (item, person, space) and the settings object carries `updatedAt`. Deletions keep a tombstone (`deleted: true`).
- Sync = load remote → `mergeDocuments(remote, local)` → save if different, guarded by Drive's file `version` as an optimistic-concurrency token. A version mismatch reloads and merges again (up to three attempts).
- Merge is per entity, last-writer-wins by `updatedAt`; equal timestamps prefer the tombstone, then a stable content order, so merge is commutative and idempotent.
- Tombstones older than 30 days are pruned at sync time.
- Remote data that fails schema validation is never adopted and never overwrites the device copy; the user sees an error.
- Sync runs debounced after changes, when the app becomes visible, when the network returns, and every two minutes while visible.

## Alternatives considered

- **Supabase or Firebase:** real database and realtime, but another account, keys, and a service to manage; reserved for a future multi-user version.
- **One Drive file per entity:** finer-grained, but many API calls per sync on a phone.
- **Field-level merge or CRDTs:** more precise for concurrent edits to the same item, but heavier; same-item concurrent edits are rare for one person.
- **Device only:** loses everything if iOS clears storage or the phone is replaced.

## Consequences

- Works fully offline; sync is eventual.
- Concurrent edits to the same entity on two devices keep the later edit whole, not a field merge.
- The whole document is uploaded on each sync; acceptable at the expected size, revisit beyond ~1 MB.
- Device clocks affect last-writer-wins; badly wrong clocks can lose an edit.
- Schema changes must stay readable by the previous app version (`change-document-schema` skill).

## Verification

- `packages/notebook-core/src/merge.unit.test.ts` covers union, newest-wins, tombstones, commutativity, pruning, and validation.
- `apps/web/src/state/notebook-store.unit.test.ts` covers first upload, external edits, version conflicts, offline and expired-auth states, and edits made during a sync.

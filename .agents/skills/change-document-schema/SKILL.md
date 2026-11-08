---
name: change-document-schema
description: Changes the stored notebook document shape in @notebook/core (items, people, spaces, settings, version) without breaking copies already in Google Drive or on devices running an older app version. Use when adding, renaming, removing, or retyping a stored field, or when changing merge or validation rules.
---

# Change the Notebook Document Schema

The document lives in three places at once: the Drive file, each device's cache, and every installed app version. Read [ADR 0003](../../../docs/adr/0003-drive-app-data-document-with-entity-merge.md) first.

## Rules

1. **Add, don't break.** New fields are optional or have `.default(...)` so documents written by older versions still parse.
2. **Older versions must keep working.** The previous release parses with its own schema: Zod objects strip unknown keys, so a new field written by a newer device is dropped when an older device saves that entity. Accept that, or keep the field's meaning safe to lose.
3. **No renames or type changes in place.** Add the new field, read both, write the new one; remove the old one only in a later release.
4. **Bump `DOCUMENT_VERSION` only for incompatible changes,** and add a migration in `parseDocument` from every older version. A bump makes older apps reject newer files, so it needs an ADR.
5. **Every entity change sets `updatedAt`.** Merge depends on it.

## Steps

1. Change `schemas.ts`; types follow by inference.
2. Update commands, selectors, and `createDocument` defaults.
3. Add tests: a document without the new field parses; merge still behaves; any migration round-trips.
4. Update `packages/notebook-core/CONTEXT.md` and root `CONTEXT.md` language when meanings change.
5. Run `verify-change`, including the web tests.

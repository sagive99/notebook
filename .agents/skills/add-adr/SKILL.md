---
name: add-adr
description: Records an architectural decision in the correct repository, application, or package scope; evaluates whether an ADR is warranted, selects status and numbering, handles supersession, updates indexes and context, and validates metadata and links. Use when the user asks to add, write, create, propose, accept, supersede, deprecate, or update an ADR or architectural decision record.
---

# Add an Architecture Decision Record

Record durable decisions without turning routine changes into permanent
documentation.

## Gather the smallest relevant context

1. Read the root `CONTEXT.md` and `CONTEXT-MAP.md`.
2. Read the affected scoped `AGENTS.md` and `CONTEXT.md`.
3. Read the root ADR index, the owning local index when present, and only ADRs
   whose scope intersects the decision.
4. Use `docs/adr/ADR-TEMPLATE.md` unless the owning scope defines another
   template.

## Decide whether an ADR is warranted

Create or update an ADR when the decision is difficult to reverse, changes a
public contract or dependency direction, crosses contexts, or establishes a
durable persistence, messaging, security, availability, or operational policy.

Routine fixes, localized refactors, ordinary feature work, and mechanical
dependency updates normally do not need an ADR. Explain that conclusion instead
of creating one unless the user explicitly requires the record.

## Choose ownership and status

- Put repository, storage, sync, auth, hosting, and cross-workspace policy in
  `docs/adr`.
- Put a decision that only concerns one workspace's internals in that
  workspace's `docs/adr`.
- Use the next unused four-digit number in the owning directory. Do not reuse
  gaps.
- Default a new decision to `proposed`.
- Mark it `accepted` only when the responsible people explicitly accepted it.
- Preserve rejected, deprecated, and superseded records as history.

## Write the decision

Include complete metadata for status, date, scope, and superseded decisions.
State the problem and constraints, the chosen policy in testable language,
meaningful alternatives, both positive and negative consequences, and how
maintainers can verify conformance.

Keep implementation detail out unless it is part of the durable constraint.
Link related ADRs instead of repeating them.

When superseding a decision:

1. Add the prior ADR to the new record's `supersedes` metadata.
2. Change the prior ADR's status to `superseded`.
3. Link the prior record to its replacement.

## Route and validate

Update the owning ADR index with title, status, scope, and a one-sentence
summary. Add a new local index to the root index and context map when this is the
scope's first ADR. Update context documents only when the decision changes
shared language or invariants.

Before completion:

- check for duplicate numbers in the owning directory;
- verify metadata, relative links, and Markdown lint;
- inspect the diff for accidental policy changes;
- report whether the record is proposed or binding.

Do not create an ADR automatically for every pull request. A significant pull
request should state whether an ADR was considered, not manufacture one.

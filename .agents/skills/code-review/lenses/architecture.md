# Lens: Architecture

Check that the change respects the layering and contracts.

- ADR 0006 layering: `@notebook/core` stays pure; UI never imports adapters; adapters never import state or UI; only `app-services.ts` constructs adapters.
- Domain logic placed in the app instead of core, or UI logic leaking into state.
- Document schema changes without the `change-document-schema` discipline (defaults, older-version compatibility).
- Sync, merge, and calendar-link behavior consistent with ADRs 0003 and 0005; a durable decision made without an ADR.
- Unneeded abstractions, speculative generality, shotgun surgery, feature envy.
- Pre-existing problems are not findings unless the diff expands them.

Output (under 400 words): standard format, citing the rule (file and section) for every finding. Never review security, performance, naming, or style.

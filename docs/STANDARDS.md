# Shared Repository Standards

These standards apply across the repository through the root [AGENTS.md](../AGENTS.md). Workspace architecture and conventions live in each workspace's scoped documents.

## Scope and compatibility

- Preserve current behavior unless the task explicitly changes it, and keep changes scoped to the request.
- Preserve unrelated user changes. Follow the affected area's established patterns before introducing abstractions or folders.
- `@notebook/web` may depend on `@notebook/core`; core never depends on the app, a UI framework, or browser APIs.
- Every device may run an older app version than the one writing the Drive file. Changes to the notebook document schema must stay readable by the previous release (see the `change-document-schema` skill).
- Add a dependency only when the task requires it and existing code or the platform cannot provide the capability. Keep the shipped bundle small: it loads on a phone.

## Boundaries and security

- Treat Google API responses, the Drive file, the device cache, URL hashes, and user-entered links as untrusted. Validate them with Zod at the boundary before domain use.
- Never log or persist OAuth tokens beyond the documented short-lived cache ([ADR 0004](./adr/0004-browser-oauth-token-model.md)). Never request scopes beyond the documented set; new scopes need an ADR.
- Render user text as text. Never use `dangerouslySetInnerHTML`. Only `http:` and `https:` links may be opened.
- Handle infrastructure failures intentionally: offline, expired sign-in, conflicts, and API errors each have a visible state. A failed sync must never claim success, and must never lose the device copy.

## Code quality

- Prefer explicit types at public and cross-process boundaries. Do not introduce `any`, non-null assertions, unsafe assertion chains, or unexplained lint suppression.
- Use `const` for variable declarations instead of `let` (loop counters excepted).
- Leave a blank line before every `if` statement and every `return` statement. Do not add a blank line before a `return` when it is the only statement in its function or its `if` block.
- Keep every static import declaration on one physical line, regardless of length.
- Domain commands are pure functions `(document, input, context) => document`; time and ids come from the `CommandContext`.
- Leave no placeholders, commented-out implementations, or unrelated cleanup.
- Mechanical rules belong in TypeScript, ESLint, tests, or dependency-cruiser. Follow the executable configuration.

## Accessibility and UI

- Interactive elements are real `<button>`, `<a href>`, `<input>`, and `<select>` elements with accessible names; icon-only buttons have `aria-label`.
- Touch targets are at least 36px (44px for primary actions). Text keeps 4.5:1 contrast.
- User-entered text uses `dir="auto"` so Hebrew and English both render correctly.

## Architecture

- Preserve the layering in [ADR 0006](./adr/0006-workspace-layering.md). An architecture change is explicit work with an ADR.
- Consider an ADR for hard-to-reverse decisions: storage format, sync semantics, OAuth scopes, hosting, or dependency direction.

## Verification

- Tests assert observable behavior. Name them `*.unit.test.ts(x)` next to the code.
- Keep test additions proportional to behavioral risk. Sync, merge, and calendar-link logic always get tests for changed behavior.
- Run meaningful workspace type checks and lint, and `pnpm validate:deps` when imports change.
- Report exact commands and outcomes. A skipped or failed required check is not a passing verification.

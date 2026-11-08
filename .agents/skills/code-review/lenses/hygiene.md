# Lens: Hygiene

Check the repository's working rules. Nits only; never blocks a merge.

- `docs/STANDARDS.md` code rules: `const` over `let`, blank line before `if`/`return`, one-line imports, no `any` or non-null assertions, no unexplained lint suppression, no placeholders or commented-out code.
- Accessibility rules: real buttons and links, accessible names, `dir="auto"` on user text.
- Tests: names `*.unit.test.ts(x)`, assertions on behavior, no skipped tests.
- Naming, dead code, duplication, unused exports, documentation drift (scoped docs not updated with the change).

Mark anything a linter would catch as "tooling". Output (under 400 words) in the standard format, grouped by file. Never raise security, performance, architecture, or spec findings.

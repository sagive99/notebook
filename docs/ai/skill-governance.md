# Repository Skill Governance

## Source of truth

- `.agents/skills` is the canonical repository skill directory. Each skill is an immediate child with a `SKILL.md` whose `name` matches the directory.
- `.agents/skills/<skill>/agents/openai.yaml` is optional OpenAI interface metadata.
- Codex, Gemini, and Cursor use `.agents/skills` directly. `.gemini/settings.json` points Gemini at `AGENTS.md`.
- Claude Code users generate a local adapter with `pnpm skills:setup:claude`. `.claude/skills` and `.gemini/skills` are gitignored and never committed.
- `pnpm skills:validate` checks every skill's frontmatter.

## Project instruction routing

Root and scoped `AGENTS.md` files are the shared project instructions. Claude Code reads them directly; the repository has no `CLAUDE.md` adapter ([ADR 0001](../adr/0001-shared-standards-and-scoped-agent-context.md)). In a new Claude session, `/memory` should list the root `AGENTS.md`.

## Adding a repository skill

A repository skill must depend on this repository's structure, contracts, or workflow; solve a repeatable task; reference context and ADRs instead of copying them; keep its body short and procedural; avoid hidden network, publication, or destructive actions; and distinguish preparation from publication. Generic skills belong in the user's own skill collection, not here.

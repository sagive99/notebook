---
status: accepted
date: 2026-11-09
scope:
  - repository-agent-configuration
supersedes: []
---

# 0001: Shared standards and scoped agent context

## Context

The repository is worked on by the owner and by coding agents (Claude Code, Codex, Cursor, Gemini CLI), including unattended cloud sessions. The owner asked for the same documentation structure as the BlackTube monorepo so that agents and his existing habits (context map, scoped context, ADRs, repository skills, self code review) carry over unchanged. That structure is recorded there as its ADR 0001.

Independent copies of instructions per harness drift, and loading everything for every task wastes context.

## Decision

- Root `AGENTS.md` is the canonical portable instruction router and explicitly requires `docs/STANDARDS.md`.
- Root `CONTEXT.md` defines shared language and invariants; `CONTEXT-MAP.md` locates workspaces, contracts, and decisions.
- Every workspace has `AGENTS.md` (local working rules and checks) and `CONTEXT.md` (purpose, architecture, invariants).
- ADRs live in `docs/adr` with their own index; workspace-local ADR directories are created only with a first real scoped decision.
- Repeatable procedures live in `.agents/skills`. Claude's adapter is generated locally with `pnpm skills:setup:claude` into the gitignored `.claude/skills`. `pnpm skills:validate` checks skill metadata.
- Claude Code reads `AGENTS.md` directly; no `CLAUDE.md` adapter is committed. Gemini is pointed at `AGENTS.md` by `.gemini/settings.json`.
- Mechanical rules live in TypeScript, ESLint, tests, and dependency-cruiser rather than prose.

## Alternatives considered

- **A single `CLAUDE.md`:** rejected; it would serve one harness and diverge from the monorepo convention.
- **No ADRs for a personal project:** rejected; storage, sync, and OAuth choices are hard to reverse and agents need their rationale.

## Consequences

- Agents working here behave as they do in the monorepo.
- Documentation must change together with architecture; reviews check this.
- Generated Claude skills need refreshing after skill changes.

## Verification

- Root instructions require the standards and route to scoped documents.
- Every workspace has both scoped documents and appears in the context map.
- `pnpm skills:validate` and `pnpm lint:md` pass.

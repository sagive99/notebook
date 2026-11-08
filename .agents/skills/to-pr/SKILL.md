---
name: to-pr
description: Prepares a pull request from the current branch by reviewing scope, relevant context and ADRs, verification evidence, risks, and the complete diff; publishes only when explicitly requested. Use when the user asks to prepare, draft, create, open, or publish a pull request.
---

# Prepare a Pull Request

## Workflow

1. Determine the base branch (`main`) and inspect status, commits, and the complete diff.
2. Find the related issue when one exists.
3. Use `CONTEXT-MAP.md` to identify affected workspaces, contracts (document schema, ports, calendar link), and devices running older versions.
4. Read relevant scoped context, instructions, and ADRs.
5. Check for unrelated, generated, secret, or local-only files (`.env*`, `dist/`, `.claude/skills/`).
6. Use `verify-change`.
7. Run `code-review` on the branch and address or answer every 🔴 and 🟠 finding before publishing.
8. Reinspect the diff after checks that may modify files.
9. Prepare a concise title and body using the structure below.

## Pull request body

- **Summary:** what changed and why.
- **Affected contexts:** workspaces, contracts, and stored data.
- **Verification:** exact commands and outcomes; screenshots for UI changes.
- **Architecture decision:** relevant ADR, new ADR, or why none is needed.
- **Self-review:** tier counts from `code-review` and how each finding was resolved.
- **Risks:** compatibility with older app versions and stored documents, security, and known limitations.
- **Follow-up:** intentionally deferred work.

Never claim a failed or skipped check passed.

## Publication

- "Prepare" or "draft" means return the title and body without creating a remote PR.
- "Create," "open," or "publish" explicitly authorizes remote PR creation.
- Before publishing, confirm the target branch and authentication.
- Do not push unrelated commits, force-push, merge, or change repository settings.
- Return the created PR link and report any publication failure.

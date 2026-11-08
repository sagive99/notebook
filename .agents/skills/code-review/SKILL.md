---
name: code-review
description: Reviews a pull request or branch diff the way the agent-city reviewer does - five specialist lenses (spec, architecture, security, performance, hygiene) run in parallel, findings verified against the code, deduplicated, tiered (blocks merge / must answer / nit), and published as one review. Use when asked to review, CR, or self-review a PR or diff, and before publishing a PR with to-pr.
---

# Code Review

You are the review manager. You brief specialists, verify what they report, assign tiers, and publish one review. Modeled on the `reviewer` agent in `sagive99/agent-city`.

## 1. Briefing pack

1. Fixed point: `git merge-base origin/main HEAD` (or the previous review's commit for a re-review). Record the diff command, commit list, and changed files.
2. Spec: the linked issue and its comments, the PR description, its assumptions. For a self-review without an issue, the user's request in the conversation is the spec; quote it.
3. Standards: `AGENTS.md`, `CONTEXT.md`, `CONTEXT-MAP.md`, `docs/STANDARDS.md`, scoped `AGENTS.md`/`CONTEXT.md` for touched paths, matching ADRs, and the matching skills (`change-document-schema` for schema changes, `add-adr` for durable decisions).
4. What other reviewers already raised, so specialists don't repeat it.

## 2. Team size

Count changed lines (`git diff --shortstat <fixed point>`, ignoring the lockfile).

- Under ~150 lines: spec, architecture, security (add performance if the diff touches sync, loops over the document, polling, or rendering lists). Say "Small-PR path" in the review.
- Otherwise, or whenever auth, tokens, the document schema, sync/merge, or calendar linking is touched: all five lenses.

Spawn the specialists **in one message, in parallel**, each with its lens file from `lenses/`, the briefing pack, and the instruction to return findings as:

`file:line | finding | evidence (quoted code) | cited rule or spec line | suggested fix | confidence high/med/low`

or "no findings".

## 3. Verify and tier

Verify every finding against the actual code yourself. Drop false positives, findings outside the diff, and duplicates (keep the stronger lens). Specialists propose; you decide. Downgrade low-confidence findings.

- 🔴 **BLOCKS MERGE:** a confirmed security issue, data loss or corruption of the stored document, a requirement implemented wrongly, or a compatibility break with stored documents or older app versions.
- 🟠 **MUST ANSWER:** architecture or layering violations, performance on realistic data, a spec gap, scope creep.
- ⚪ **NIT:** hygiene and judgement calls.

## 4. Publish one review

- Body: a tier summary (`🔴 n · 🟠 n · ⚪ n`), one section per lens (or "no findings"), all ⚪ nits in the body, and "Skills used: …" (truthful).
- Inline comments only for 🔴 and 🟠 findings that map to a diff line: "🔴 BLOCKS MERGE · Security" (or 🟠 / lens), then the problem, evidence, cited rule, and a concrete fix.
- On GitHub: `POST /repos/{owner}/{repo}/pulls/{n}/reviews` with `event: "COMMENT"` and `commit_id` = head SHA. If a position is rejected (422), move that finding into the body and retry once.
- A self-review on your own PR never approves or requests changes; it comments. Fix the 🔴/🟠 findings in follow-up commits and reply on each thread with the fixing commit.

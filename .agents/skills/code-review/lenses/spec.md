# Lens: Spec

Decide whether the change does what was asked, no more and no less.

1. List every requirement and acceptance criterion with a quote from the spec (issue, PR body, or the owner's request).
2. For each, find the code and test that satisfy it, or mark it missing or partial.
3. Find code no requirement asked for (scope creep).
4. Find requirements implemented wrongly (wrong default, wrong condition, wrong error behavior).
5. Check each stated assumption is reasonable and flagged where it matters.

Output (under 400 words): findings in the standard format, then a requirement checklist (satisfied / partial / missing). Never judge style, architecture, security, or performance.

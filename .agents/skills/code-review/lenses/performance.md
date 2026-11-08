# Lens: Performance

Find performance and resource problems on a phone with a realistic notebook (thousands of items, months of use).

- Work per render: repeated full-document scans, JSON serialization, or sorting inside render paths that run on every keystroke.
- Sync cost: uploads when nothing changed, sync loops, polling while hidden, unbounded retries.
- API cost: N+1 calls to Google APIs, missing limits on list calls.
- Leaks: listeners, intervals, subscriptions, or observers not cleaned up.
- Bundle size growth from new dependencies.

Estimate the cost (items, calls, bytes, ms) in each finding; "could be slow" is not a finding. Output (under 400 words) in the standard format. Never micro-optimize cold paths.

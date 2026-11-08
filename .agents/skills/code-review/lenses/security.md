# Lens: Security

Find security defects introduced by the diff, with evidence. Precision over volume: confirmed issues block the merge.

- OAuth: tokens logged, sent anywhere but Google APIs, stored beyond ADR 0004, scopes wider than documented, popups triggered outside user gestures.
- Untrusted input reaching the domain without Zod validation: Google responses, the Drive file, the device cache, the URL hash.
- XSS: `dangerouslySetInnerHTML`, HTML built from strings, `href`/`src` from user or API data without an `http(s)` check, `target="_blank"` without `rel="noopener noreferrer"`.
- Query injection into Google API parameters (Drive `q`, Gmail `q`) from user input.
- Secrets committed (client secrets, tokens, `.env`).
- New dependencies with install scripts, low maintenance, or typosquat-like names.

Trace each issue from entry point to sink before reporting it; if you cannot show the path, mark it low confidence. Output (under 400 words): standard format plus the attack path in one sentence. Never give generic hardening advice the diff did not touch.

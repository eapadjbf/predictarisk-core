---
name: Plain-language jargon scrubbing
description: How to strip technical security jargon from board/executive-facing copy in cyber-analyzer.
---

# Scrubbing technical jargon for executive/board copy

When rendering security threat names in a plain-business-language surface (e.g. the
Executive View tab for CEO/CFO/Board), do NOT trust an exact-string dictionary lookup
keyed on `eventType`.

**Why:** `eventType` values are free-form (produced by the AI / uploaded spreadsheet),
so real values look like `"DDoS attack"`, `"XSS attempt"`, `"SQLi payload"`,
`"RCE exploit"`, `"SQL injection"` — not the bare token `"ddos"`. An exact-match map
silently passes the raw jargon straight through to the board statement, the action-plan
titles, and the "Top Threat" card.

**How to apply:** Use word-boundary regex replacement (`\b…\b`, `gi`) for each known
technical token, and have each pattern optionally consume a trailing generic noun
(`attacks?|attempts?|exploits?|payloads?|incidents?`) so `"DDoS attack"` collapses to a
single plain phrase instead of leaving "attack" dangling or duplicated. Apply the same
helper everywhere a threat name is shown to non-technical readers. See `humanizeThreat`
in `artifacts/cyber-analyzer/src/pages/results.tsx`.

Related zero-data guard in the same view: when `lossPotentials` is empty,
`maxExposure=0` ⇒ skip ROI math entirely (`roiLabel="N/A"`, no remediation budget) and
branch the board paragraph to a no-financial-exposure sentence. Never force a minimum
remediation cost of 1 — it produces a misleading "1:0×" / "0× return".

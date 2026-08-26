# Code Review

Single source of truth for review format. No other file defines a review table.

---

## Before every review

Check `docs/reviews/` for open `NNN-review.md` files.

- **Open reviews exist** → fix Critical/High findings first, then review new code
- **No open reviews** → proceed

---

## Running a review

1. Fetch current docs for every package in the diff (official docs, or a docs
   MCP if the tool has one)
2. Score each finding **0–10** — lower is worse
3. Look for: security holes · correctness bugs · accessibility violations ·
   anti-patterns · dead code · performance issues

Every review ends with a **security + best-practices pass**. Use the project's
stack reviewers when they exist; otherwise do the pass yourself. Don't call
the work done without it. Named reviewers live in the tool adapter, not here.

---

## Output format

A table, ordered by criticality (Critical → Low), and within each level from
**quickest to most complex fix**:

| # | Criticality | Type | Finding | File:line | Effort | Status |
|---|-------------|------|---------|-----------|--------|--------|

Types: `security` · `general bug` · `business-logic bug` · `logic bug` ·
`compilation error` · `performance` · `accessibility` · `style/best practice`

---

## Severity scale

| Severity | Score | Examples |
|----------|-------|----------|
| Critical | 0–2 | Open redirect, auth bypass, XSS, SQL injection |
| High | 3–4 | PII leak, missing validation, broken a11y on core flows |
| Medium | 5–6 | Dead code, inconsistent validation, missing error states |
| Low | 7–8 | Anti-patterns, minor perf issues, style inconsistency |
| Clean | 9–10 | No issue |

---

## Review file

Save to `docs/reviews/NNN-review.md`. Required fields:

- Date
- Scope (what was reviewed)
- Overall quality score (0–10 average)
- % of findings resolved vs. the prior review
- Findings table (above)
- Fix order by priority

---

## Fixing & closing

- **Critical + High** → fix in the same session
- **Medium + Low** → fix before starting the next feature
- All findings resolved → delete the review file. Next review starts at `NNN+1`.

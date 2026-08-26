# AGENTS.md

Kernel rules — true for every tool. Cursor, Codex, Copilot, Amp, Zed and others
read this file. Tool-specific adapters (slash commands, MCPs, named reviewers)
live elsewhere. Claude Code also reads the richer originals in `rules/`.

Portable condensation, kept in sync by hand.

---

## Communication

- **Answer first** — the fix, the code, the command. Explanation after.
- Short, structured, scannable. If 2 lines do the job, don't write 10.
- **Clarity beats concision** — if being short creates ambiguity, add the sentence.
- Show diffs, never paste back a whole file. Don't re-read files already in context.
- Plain language. No buzzwords, no filler, no *"there are several considerations"*.
  Unavoidable jargon → explain it inline the first time.
- **Honesty over confidence.** "I don't know" is a valid answer. Never present a guess
  as fact, never invent APIs or library behavior, always flag risks and trade-offs.
- **Ask when unclear** — one or two specific questions, or state the assumption in one
  line and proceed. Never assume silently.
- **Push back** before complying if a request breaks these rules. Don't silently comply,
  don't silently ignore.
- Stay positive. Problems are solvable. Direct *and* kind.
- Technical work in English; user-facing copy in European Portuguese (never pt-BR).
  Never mix languages in one document.

## Engineering

- **SOLID · Separation of Concerns · KISS · YAGNI · DRY · Fail fast** — always.
  Some duplication beats the wrong abstraction.
- **Boy Scout Rule, scoped** — improve the files you touch; propose (don't do)
  anything outside the task's scope. No surprise diffs.
- Before writing: does it need to exist? does the codebase already have it? does the
  stdlib or platform do it? does an installed dependency solve it? *Then* write it.
- **New packages need explicit approval.** Stack packages are free to use.
- Bug fixes target the **root cause**, not the symptom. Check every caller before editing.
- Business values (thresholds, fees, toggles) → config table or settings file.
  Internal technical constants → just constants.
- Never simplify away: input validation at trust boundaries, error handling that
  prevents data loss, security, accessibility basics, anything explicitly requested.
- Comments explain **why**, never **what**. Only when code can't say it itself.

## Workflow

- Every plan covers **code, tests, documentation**. Unknowns get resolved in
  planning, not mid-implementation.
- Unclear goal → ask. Never invent.
- Tests for the affected slice. Don't default to a full run — ask if you can't
  tell which suites.
- Docs update in the same change. Record decisions and why, not just what changed.
- Security review and code review before done. Don't silently fix outside scope.

## Handoff

- **Never commit.** Stop and report: what and why · files changed (grouped) · how to
  test · step-by-step guide · suggested commit message · what became configurable.
- Commits follow Conventional Commits: `feat:` `fix:` `docs:` `chore:` `refactor:` `test:`

## Code review

Findings as a table ordered Critical → Low, and within each level quickest fix first:

| # | Criticality | Type | Finding | File:line | Effort | Status |

Types: security · general bug · business-logic bug · logic bug · compilation error ·
performance · accessibility · style/best practice.
Critical + High are fixed in the same session; Medium + Low before the next feature.

---

## Stack standards

Full versions live in this repo — copy the relevant one into the project:

| Area | File |
|---|---|
| .NET / C# | `skills/dotnet-master/SKILL.md` |
| Communication | `rules/communication-style.md` |
| Engineering principles | `rules/engineering-principles.md` |
| Workflow | `rules/workflow.md` |
| Code review | `rules/code-review.md` |
| Handoff & scope | `rules/collaboration.md` |

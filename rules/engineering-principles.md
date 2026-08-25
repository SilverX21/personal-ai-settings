# Engineering Principles

Non-negotiable, every task, every language. Stack-agnostic — the stack-specific
standards live in the skills (`dotnet-master`, the Vercel React skills, `shadcn`).

---

## Core

- **SOLID** — single responsibility, open/closed, Liskov, interface segregation, dependency inversion
- **KISS** — simplest solution that works. Avoid over-engineering.
- **YAGNI** — don't build what isn't needed yet
- **DRY** — with judgment. Some duplication beats the wrong abstraction.
- **Fail fast** — validate inputs early at trust boundaries
- **Boy Scout Rule — scoped** — improve the files you touch as part of the task
  (naming, dead code, small cleanups). Improvements *outside* the task's scope are
  **proposed, never silently done.** No scope creep, no surprise diffs.

Reference only, do not fetch during sessions: <https://lawsofsoftwareengineering.com/>

---

## Before writing code

1. **Does this need to exist at all?** Speculative need → skip it, say so in one line.
2. **Does the codebase already have it?** A helper, util, type, or pattern that already
   lives here → reuse it. Re-implementing what's a few files over is the most common waste.
3. **Does the stdlib or the platform do it?** Native feature over a dependency.
4. **Does an already-installed dependency solve it?** Never add a new one for what a
   few lines can do.
5. Only then: the minimum code that works.

Stack packages are free to use. **New packages need explicit approval.**
Prefer native features first; if the native path is disproportionately complex,
propose a package and say why.

---

## Bug fixes

A report names a **symptom**. Fix the **root cause**.

Before editing, find every caller of the function you're about to touch. One guard in
the shared function is a smaller diff than a guard in every caller — and patching only
the path the ticket names leaves every sibling caller broken.

---

## Configurability — with YAGNI balance

- **Business values** (thresholds, percentages, fees, limits, feature toggles) → DB
  config tables; admin UI when it earns it
- **Environment concerns** → `appsettings.json` / `.env` / equivalent
- **Internal technical constants** do not need config tables

Configure business and environment values, not everything. Always report what you made
configurable and where.

---

## Never simplify away

Input validation at trust boundaries · error handling that prevents data loss ·
security measures · accessibility basics · anything explicitly requested.

---

## Multi-task strategy

- Request splits into independent subtasks → split it, use subagents
- Task too complex → break it down first, then one subtask at a time
- Context missing → **ask**. Never assume.

---

## Comments

Only when strictly necessary — code should be self-explanatory. Reserve comments for
non-obvious intent, trade-offs, or constraints the code can't convey. Comments explain
**why**, never **what**.

---

## Token discipline

- Load only the files you need
- Never read whole epic/spec files — grep the ID, read that section
- `/caveman` for chat replies and internal notes **only** — never for documentation,
  code comments, commit text, or user-facing copy

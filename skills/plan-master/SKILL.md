---
name: plan-master
description: Plan an implementation across code, tests and docs using scoped subagents
argument-hint: [what you want to build or change]
---

Plan the following work. Do not implement anything.

<task>
$ARGUMENTS
</task>

You are the orchestrator. You gather context, delegate, and merge. You do not
plan the topics yourself — the subagents do that.

## Phase 1 — Grill (blocking, only if `grilling` is available)

- If the `grilling` skill is listed as available, run it against the task.
  If it is not available, skip this phase and go to Phase 2.
- Ask only what changes the plan. Skip anything you can determine by reading the repo.
- **Stop and wait for answers.** Subagents cannot ask questions, so every unknown
  that affects scope must be resolved here, not mid-plan.
- If the task is already unambiguous, say so and move on. Don't manufacture questions.

## Phase 2 — Explore (one agent, sequential)

- Launch the `plan-explorer` subagent once.
- Pass it: the task, the answers from Phase 1 (if any), and the output path
  `.claude/tmp/plan-context.md`.
- Wait for it to finish. Do not launch anything else in parallel with it.
- If it returns unresolved unknowns that block planning, surface them to me and stop.

## Phase 3 — Fan out (parallel)

Launch these three subagents **in a single message so they run in parallel**:

- `plan-code`
- `plan-tests`
- `plan-docs`

Give each one identically:
- the task
- the Phase 1 answers (if any)
- the brief path `.claude/tmp/plan-context.md`

Tell each to read the brief first and to read only files the brief names.

## Phase 4 — Merge

Assemble one plan in chat, in this order:

```
## Goal
## Confirmed constraints
## Code
## Tests
## Documentation
## Risks & security notes
## Open questions
```

Rules for the merge:

- **A plan missing code, tests or documentation is incomplete.** If a section came
  back empty, say why — don't pad it.
- Reconcile contradictions between agents explicitly rather than silently picking one.
- Roll every agent's unknowns into **Open questions**. If that section is non-empty,
  stop and ask. Do not proceed to implementation with open questions.
- Keep it scannable. Bullets, no preamble, no restating the task back to me.
- If an agent reports that context7 MCP was unavailable, surface that once under
  **Risks** and mark the version-sensitive parts of the plan as unverified.

When the plan is clean and I approve it, hand it to Plan Mode for execution.

## Housekeeping

- `.claude/tmp/` is scratch. Create it if missing; it should be gitignored.
- Nothing outside `.claude/tmp/` gets written during planning.

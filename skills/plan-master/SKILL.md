---
name: plan-master
description: Plan an implementation across code, tests and docs using scoped subagents. Use when asked to plan or design a change before implementing it.
argument-hint: [what you want to build or change]
disable-model-invocation: true
---

Plan the following work. Do not implement anything.

<task>
$ARGUMENTS
</task>

You are the orchestrator. You gather context, delegate, and merge. You do not
plan the topics yourself — the subagents do that.

Pick a short kebab-case `<slug>` for this task. All scratch files use it, so
concurrent plans never overwrite each other:
- brief: `.claude/tmp/plan-context-<slug>.md`
- plan: `.claude/tmp/plan-<slug>.md`

## Phase 0 — Size gate

If the task touches at most 2 files and changes no public contract (signature,
DTO, endpoint, schema, event), skip Phases 2–3. Plan it inline in the Phase 4
format, keeping it short. Say that you took the shortcut and why.

## Phase 1 — Grill (blocking, only if `grilling` is available)

- If the `grilling` skill is listed as available, run it against the task.
  If it is not available, skip this phase and go to Phase 2.
- Ask only what changes the plan. Skip anything you can determine by reading the repo.
- **Stop and wait for answers.** Subagents cannot ask questions, so every unknown
  that affects scope must be resolved here, not mid-plan.
- If the task is already unambiguous, say so and move on. Don't manufacture questions.

## Phase 2 — Explore (one agent, sequential)

- Create `.claude/tmp/` if missing and add it to `.git/info/exclude` if it is not
  already ignored (local only; no repo files change).
- Launch the `plan-explorer` subagent once.
- Pass it: the task, the answers from Phase 1 (if any), and the brief path.
- Wait for it to finish. Do not launch anything else in parallel with it.
- **Verify the brief before fanning out:** the file exists, is non-empty, and has
  an `## Unknowns` section. If not, re-run the explorer once; if it still fails,
  stop and tell me.
- If Unknowns contain items that block planning, surface them to me and stop.

## Phase 3 — Fan out (parallel)

Launch these subagents **in a single message so they run in parallel**:

- `plan-code`
- `plan-tests`
- `plan-docs` — skip it when the brief's Docs locations section is empty, and
  say so under **Documentation** in the merge.

Give each one identically:
- the task
- the Phase 1 answers (if any)
- the brief path

Tell each to read the brief first, to read only files the brief names, and to
return at most 60 lines using the headings `Risks` and `Unknowns` for those parts.

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
## Assumptions
```

Rules for the merge:

- **A plan missing code, tests or documentation is incomplete.** If a section came
  back empty, say why — don't pad it.
- Reconcile contradictions between agents explicitly rather than silently picking one.
- Roll every agent's unknowns into one of two buckets:
  - **Open questions** — answers that change scope or a contract. If this section
    is non-empty, stop and ask. Do not proceed to implementation.
  - **Assumptions** — small gaps with a sensible default. State the default so I
    can confirm or correct it; these do not block.
- Keep it scannable. Bullets, no preamble, no restating the task back to me.
- If an agent reports that context7 MCP was unavailable, surface that once under
  **Risks** and mark the version-sensitive parts of the plan as unverified.

## Phase 5 — Handoff

When Open questions is empty:
1. Save the merged plan to `.claude/tmp/plan-<slug>.md`, so it survives `/clear`.
2. Tell me the path, then call `EnterPlanMode` and present the plan for approval.

## Housekeeping

- `.claude/tmp/` is scratch. Nothing outside it gets written during planning,
  except the `.git/info/exclude` line above.

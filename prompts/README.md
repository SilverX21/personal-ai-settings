# Prompts

Two one-off prompts that generate or update a project's `AGENTS.md` so every AI tool (Claude, Codex, Cursor, Copilot, OpenCode) starts from the same rules.

Both seed from the kernel in this repo's root `AGENTS.md`. Rules live in the kernel; the prompts only tell the agent how to apply them.

## Which one?

| Situation | Prompt |
|---|---|
| Empty or near-empty repo, no agent rules yet | [`new-project.md`](new-project.md) |
| Repo has code and/or docs, but no agent rules | [`ongoing-project.md`](ongoing-project.md) |
| Repo already has `AGENTS.md`, `CLAUDE.md`, `.cursor/rules`, Copilot instructions, hooks, or CI rule checks | [`ongoing-project.md`](ongoing-project.md) |
| Unsure | [`ongoing-project.md`](ongoing-project.md). It audits first and changes nothing until you approve. |

## Differences

| | new-project | ongoing-project |
|---|---|---|
| Starts with | Seed from kernel | Read-only audit of existing rules, then seed from kernel |
| Empty repo | Interviews you | Not designed for it |
| Existing `AGENTS.md` | Not expected | Merged into, never overwritten |
| Stops for approval | On missing info | On missing info, conflicts, and any rule removal |
| Handoff report | Standard | Adds a rules-audit table (kept / merged / changed / removed) |

## How to run

1. Open the target project in your AI tool (Claude Code, Codex, Cursor, etc.) at the repo root.
2. Make sure the kernel is reachable: `/Users/nunoaraujo/Docs do Nuno/personal-ai-settings/AGENTS.md`. If the agent can't read it, it will ask you to paste it.
3. Paste the full contents of the chosen prompt file as your first message.
4. Answer its questions.
   - `new-project`: it interviews you if the repo is empty.
   - `ongoing-project`: it shows the rules audit and waits. Approve or reject each conflict and removal.
5. Review the diff. The agent never commits or pushes.
6. Copy the per-tool adapters (`CLAUDE.md`, Cursor, Copilot) into the project. Commands in [`../templates/README.md`](../templates/README.md).
7. Follow its handoff: test with a fresh session per tool, then commit with the suggested Conventional Commits message.

## Rules of thumb

- Run one prompt per project, once. After that, edit `AGENTS.md` by hand or use the normal workflow.
- Run it in a clean session so earlier context doesn't leak in.
- Re-run `ongoing-project.md` only to realign a repo after the kernel changes. Review the audit table each time.
- Output language is English for now.

## Maintenance

- The two prompts share about 80% of their text (Phases 1–5 and the 14-section structure). Change both together or they drift.
- The kernel path is hardcoded to this machine in both prompts (Phase 0 / 0.5). Update it if the repo moves.

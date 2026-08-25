---
name: scaffold-feature
description: >
  Run the full .NET feature pipeline end-to-end through the specialist subagents —
  architect → implementer → tester → reviewer + security. Use when the user asks to
  scaffold or build a .NET / C# feature through the agents, "run the full pipeline",
  "scaffold a feature", or "run scaffold-feature".
---

# Scaffold a .NET feature end-to-end

Run the full .NET feature pipeline for the feature the user described.

Execute these stages in order, waiting for each to finish before starting the next. Delegate each
stage to its subagent via the Task tool.

1. **Architect** — delegate to the `dotnet-architect` subagent to produce `PLAN.md` (architecture
   decision, project structure, contracts, implementation task list, and risks). No implementation
   code in this step.
2. **Implementer** — once `PLAN.md` exists, delegate to `dotnet-implementer` to implement every task
   in the plan, marking tasks complete as it goes.
3. **Tester** — delegate to `dotnet-tester` to write unit + integration tests for the implemented code.
4. **Review gates** — delegate to `dotnet-reviewer` (produces `REVIEW.md`) and `dotnet-security`
   (produces `SECURITY-REPORT.md`). Both are read-only.
5. **Summary** — report what was built, where `PLAN.md`, `REVIEW.md`, and `SECURITY-REPORT.md` live,
   and list any Critical/High findings that must be fixed before merge.

If any stage reports blocking issues (failing build, Critical security finding), stop and surface
them rather than continuing to the next stage.

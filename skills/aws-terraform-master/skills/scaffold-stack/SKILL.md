---
name: scaffold-stack
description: >
  Run the full AWS infrastructure pipeline end-to-end through the specialist subagents —
  architect → implementer → reviewer + security + cost. Use when the user asks to scaffold
  or build AWS infrastructure through the agents, "run the full pipeline", "scaffold a
  stack", "build this infrastructure properly", or "run scaffold-stack".
---

# Scaffold an AWS stack end-to-end

Run the full infrastructure pipeline for the workload the user described.

Execute these stages in order, waiting for each to finish before starting the next.
Delegate each stage to its subagent via the Task tool.

**Before stage 1 — confirm the requirements exist.** The architect cannot design without
expected load, data sensitivity, RTO and RPO as numbers, compliance constraints, and
budget expectation. If the user has not given them, ask before starting the pipeline. A
design built on assumed requirements is rework, and every later stage inherits the error.

1. **Architect** — delegate to `aws-architect` to produce `PLAN.md`: account and network
   topology, CIDR allocation, service selection with reasons, state boundaries, module
   inventory, security and resilience posture, build sequence, and the one-way-door
   decisions. No Terraform in this step.

   **Stop and surface the plan before continuing.** Account structure and CIDR allocation
   cannot be changed later without a migration, so they get human review *before* code
   exists, not after.

2. **Implementer** — once `PLAN.md` is approved, delegate to `tf-implementer` to write the
   Terraform: `versions.tf`, backend, variables with validation, resources, outputs, and
   `.tftest.hcl` tests for anything with logic. It runs `fmt`, `validate`, and `test`, and
   `plan` if credentials exist — it never applies.

3. **Review gates** — run these three in parallel; all are read-only:
   - `tf-reviewer` → correctness, structure, maintainability
   - `aws-security` → produces `SECURITY-REPORT.md`
   - `aws-cost` → cost drivers and architecture-level savings

4. **Summary** — report what was built, where `PLAN.md` and `SECURITY-REPORT.md` live, and
   list every Critical/High finding that must be fixed before merge. State plainly whether
   `terraform plan` ran, and if it did, whether anything is being **destroyed or replaced**.

**Stop and surface rather than continuing** if any stage reports: a failing `validate` or
`test`, a Critical security finding, a plan that destroys or replaces a stateful resource,
or a CIDR that overlaps existing allocations.

**Never apply.** This pipeline produces reviewed, ready-to-apply code. A human applies it
through the merge pipeline — that is the whole point of the review gates.

---
last_reviewed: 2026-09-11
---

# Workflows and CI/CD

## Standard local workflow

```text
init -> fmt -> validate -> plan -> review -> apply
```

Production should separate approval from execution where practical.

## CI/CD baseline

A risk-adjusted pipeline commonly includes:

```text
format check
-> validate
-> lint (optional/material)
-> tests
-> plan
-> plan review
-> approval
-> apply
```

Do not add stages merely for ceremony. High-risk production roots need stronger gates than an ephemeral development sandbox.

## Plan once, apply the reviewed plan

For workflows that require exact plan/apply continuity:

```bash
terraform plan -out=tfplan
terraform apply tfplan
```

A saved plan improves predictability because the reviewed plan is the plan being applied, subject to Terraform's normal validity checks at apply time.

Treat plan files as sensitive artifacts. Restrict access/retention and never publish them publicly.

## Pull-request workflow

A strong PR workflow can:

1. Run `fmt -check` and `validate`.
2. Run unit/mock tests and selected integration tests.
3. Initialize with controlled backend/provider settings.
4. Generate a plan using least-privilege plan credentials.
5. Surface a human-readable summary.
6. Require review for replacements/destroys or policy violations.
7. Apply only after merge/approval with appropriately scoped credentials.

Avoid letting untrusted fork code obtain privileged cloud credentials.

## Authentication

Prefer short-lived credentials:

- OIDC/workload identity federation.
- Managed identity.
- IAM roles.
- HCP Terraform dynamic provider credentials where applicable.

Avoid long-lived access keys/client secrets in CI secret stores when the platform supports a safer identity federation model.

## Environments

Use separate state and permissions where environment isolation matters. Do not rely on a single shared mutable workspace/context when production credentials/blast radius must be independently controlled.

## Provider and Terraform versions

Pin/constrain intentionally in configuration, commit `.terraform.lock.hcl` for root configurations, and use the same approved Terraform version in CI/apply runners.

Upgrade through reviewed pull requests. A provider lock-file diff is a dependency change.

## Backend initialization

Backend credentials/config are security-sensitive. Avoid hardcoded secrets and understand that backend configuration can be cached in `.terraform` and plan artifacts.

Do not run multiple apply jobs against the same state concurrently. Rely on backend locking and pipeline concurrency controls rather than disabling locks.

## Destructive plan gates

Automatically flag or require elevated review for:

- Resource replacement (`-/+`).
- Destroy (`-`).
- Backend/state migration.
- Database/storage deletion.
- Network/identity/DNS/encryption changes.
- Production resource changes with known downtime risk.

A zero-error pipeline does not make a destructive plan safe.

## HCP Terraform

When using HCP Terraform, use workspaces/projects/permissions and current HCP features rather than reproducing every control manually in an external pipeline. Verify current HCP documentation for run modes, dynamic credentials, policy/run tasks, state/output sharing, and workspace permissions.

## Verification after apply

Depending on risk, verify:

- Terraform apply completed and state persisted.
- Critical outputs are correct.
- Postconditions/checks passed or warnings were understood.
- Service-level health is acceptable.
- No unexpected drift/replacements occurred.
- Rollback/recovery artifacts remain available where needed.

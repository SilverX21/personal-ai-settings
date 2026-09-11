---
last_reviewed: 2026-09-11
---

# State, backends, locking, and workspaces

## State is critical data

Terraform state binds configuration addresses to remote objects and stores values Terraform needs to reason about them. State may contain sensitive values even when CLI output is redacted.

Treat state as sensitive, durable operational data.

Never commit `terraform.tfstate` or backups to Git. Do not manually edit state JSON.

## Remote state

For collaborative or production use, prefer secure remote state so operators share a single authoritative state location and avoid local-file concurrency problems.

Evaluate a backend for:

- Encryption at rest/in transit.
- Least-privilege access control.
- Durability/backups/versioning.
- State locking or equivalent concurrency protection when supported.
- Auditability.
- Recovery procedures.

Remote state can still be written locally if Terraform encounters an unrecoverable backend persistence error; handle recovery files carefully.

## Locking

When a backend supports locking, Terraform locks state for operations that can write it. Do not disable locking casually with `-lock=false`.

Use `terraform force-unlock` only when automatic unlocking failed and you have confirmed no active run owns the lock. Force-unlocking someone else's active lock can create multiple writers and corrupt state.

## Backend credentials

Do not hardcode backend credentials in Terraform files. HashiCorp warns that secrets supplied through backend configuration, including some `-backend-config` usage, may be persisted in `.terraform` working data and plan files.

Prefer environment/workload-identity mechanisms supported by the backend.

## S3 backend current note

At this review date, current HashiCorp S3 backend docs support native S3 lockfile locking via `use_lockfile = true` and mark DynamoDB-based locking as deprecated for future removal. Do not repeat older “S3 requires DynamoDB locking” advice without checking the current docs.

HashiCorp also recommends bucket versioning for state recovery. See `providers/aws.md` for Terraform/AWS boundary guidance.

## AzureRM backend current note

The AzureRM backend uses Azure Blob Storage and supports locking/consistency with native Blob capabilities. Current HashiCorp docs recommend Microsoft Entra ID authentication, with OIDC/workload identity federation recommended for applicable automation scenarios, and warn against embedding secrets in backend configuration.

See `providers/azure.md`.

## State sharing between configurations

Avoid giving a consumer full state access merely to retrieve one value.

Preferred order:

1. Provider data sources or a deliberately published external integration value.
2. HCP Terraform `tfe_outputs` when using HCP Terraform/Terraform Enterprise and it fits the design.
3. `terraform_remote_state` only when necessary and with deliberate access controls.

HashiCorp warns that a consumer capable of reading root outputs through `terraform_remote_state` effectively needs access to the full state snapshot, which may include sensitive data.

## State boundaries

Split state based on blast radius, ownership, permissions, lifecycle/change cadence, and operational independence.

Avoid both extremes:

- One giant state containing unrelated systems.
- Dozens of tiny states that require heavy cross-state wiring.

A good boundary can be planned, applied, recovered, and permissioned independently with limited coupling.

## Environment isolation

Possible approaches include separate root directories/configurations, separate states/backends, HCP Terraform workspaces, and Terraform CLI workspaces.

Prefer explicit separation when environments require different credentials, access controls, blast radius, or lifecycle.

## CLI workspaces vs HCP Terraform workspaces

They are not the same concept.

- Terraform CLI workspaces are separate state instances for the same working directory/configuration.
- HCP Terraform workspaces contain their own configuration/run/state context and are a major organizational/access-control unit.

Current HashiCorp CLI docs recommend alternatives for complex deployments requiring separate credentials and access controls. Do not automatically make CLI workspaces the default environment strategy.

## State operations

Before `state mv`, `state rm`, backend migration, or import-related state changes:

1. Confirm the exact state/backend/workspace.
2. Ensure no concurrent operation is running.
3. Capture/verify available backend versioning or recovery mechanism.
4. Preview a declarative alternative (`moved`, `removed`, `import` blocks) when supported.
5. Run a plan immediately after the change.
6. Document the migration in version control when possible.

## Recovery

Recovery depends on the backend. Prefer backend-native versioning/snapshots and a documented restore process. Do not invent state JSON edits as a normal recovery method.

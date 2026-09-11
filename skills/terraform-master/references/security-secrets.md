---
last_reviewed: 2026-09-11
---

# Security, credentials, secrets, and supply chain

## Threat model

Terraform can expose sensitive information through:

- `.tf` / `.tfvars` files.
- State and state history.
- Saved plans.
- CLI/CI logs.
- Provider/backend configuration.
- Outputs.
- Local `.terraform/` working data.
- Over-permissive backend access.
- Third-party providers/modules.

Treat state and saved plan artifacts as secrets-capable data.

## Credentials

Never hardcode access keys, client secrets, API tokens, or passwords in Terraform configuration.

Prefer, in order appropriate to the platform:

- Workload identity / OIDC federation.
- Managed identity / IAM roles.
- Dynamic/temporary credentials.
- Provider-supported environment authentication.
- Secret managers for values that truly must be retrieved.

Use least privilege and separate planning/apply identities when your governance model benefits from it.

## `sensitive = true`

Marking a variable/output sensitive prevents normal display in many CLI/UI contexts. It does **not** automatically guarantee the value is omitted from Terraform state.

Do not tell users that `sensitive = true` “encrypts” or “removes” the secret from state.

## Ephemeral values

Modern Terraform includes ephemeral capabilities intended to avoid persisting supported temporary values to state/plan artifacts.

At this review date, official HashiCorp docs state:

- `ephemeral` variables and ephemeral resources require Terraform v1.10+.
- Managed-resource write-only arguments require Terraform v1.11+.
- Providers/resources must explicitly support relevant ephemeral resource types or write-only arguments.

Verify the current Terraform version and Registry schema before recommending these features.

Ephemeral values have restricted reference contexts; do not assume an ephemeral value can be used anywhere a normal value can.

## State security

Prefer remote state for teams/production with:

- Encryption at rest.
- TLS/in-transit protection.
- Least-privilege access.
- Audit logs where available.
- Versioning/backups.
- Locking/concurrency protection.

Limit raw state access. Consumers that only need integration values should use narrower publication/output mechanisms when possible.

## Backend credentials

Avoid secrets in backend blocks and careless `-backend-config` usage. HashiCorp warns backend configuration can be copied into `.terraform` data and saved plan files.

Prefer the backend's environment/workload-identity mechanisms.

## Saved plans

A binary saved plan can contain sensitive values required to apply the exact plan. Treat it as a sensitive build artifact:

- Restrict access.
- Keep retention short.
- Do not publish publicly.
- Do not assume redacted CLI output means the plan artifact is harmless.

## CI/CD identity

Prefer short-lived federation over stored static cloud credentials. Scope credentials to the environment/workspace and operations they require.

Protect production applies with review/approval and branch/environment controls appropriate to the organization.

## Supply chain

Providers and modules are dependencies.

Use:

- Trusted provider sources.
- Explicit provider source addresses.
- Intentional version constraints.
- Committed provider lock files for root configurations.
- Reviewed module sources and pinned/constrained versions.
- Maintained modules with clear ownership.

Before adopting a third-party module, ask whether it is maintained, necessary, understandable, and safer than a small internal module.

Do not casually introduce unknown public modules into privileged infrastructure code.

## Logging hygiene

Do not print secrets in debugging output, provisioner commands, shell traces, CI logs, or outputs. Be cautious when asking users to share full plan/state files for troubleshooting; prefer targeted redacted excerpts.

## Security review questions

- Could this value reach state or a plan?
- Who can read current/historical state?
- Are credentials short-lived?
- Is the backend identity least privilege?
- Are providers/modules trusted and versioned intentionally?
- Could a plan replace/destroy a security-sensitive resource?
- Do outputs reveal internal/secrets data?
- Is any secret passed through a command line or persisted working directory?

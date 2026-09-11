---
last_reviewed: 2026-09-11
---

# Testing and validation

## Layers

Use the smallest mechanism that validates the intended contract.

### Formatting

```bash
terraform fmt -check -recursive
```

Formatting is not semantic validation but keeps review noise low.

### Static configuration validation

```bash
terraform validate
```

Validates syntax and internal consistency of configuration. It does not prove credentials, permissions, remote API behavior, or a safe plan.

### Variable validation

Use for invalid caller inputs that can be rejected early.

### Preconditions

Use when an assumption must be true before Terraform proceeds with an individual resource/data/output operation.

### Postconditions

Use to verify expected values after planning/applying a resource/data source and to block dependent operations when the condition fails.

### `check` blocks

Use for infrastructure assertions outside the normal lifecycle. Current Terraform documentation states failed `check` assertions warn and continue rather than blocking the operation.

### Native module/configuration tests

Use `terraform test` with `.tftest.hcl` / `.tftest.json` for behavioral testing.

Tests can use plan-like or apply-like run modes depending on the case. Apply-based tests with real providers can create real infrastructure.

## Provider mocking

Current HashiCorp docs document provider/resource/data mocking in Terraform tests. At this review date, provider mocking is documented as available from Terraform v1.7.0 onward.

Use mocks to test module logic, expressions, assertions, and contracts without credentials or infrastructure when real provider behavior is not what the test is meant to prove.

Do not claim a mocked test validates:

- Real cloud API constraints.
- Actual IAM/authorization.
- Provider CRUD behavior.
- Eventual consistency.
- Service quotas.
- Real network/data-plane behavior.

Use real integration tests for those concerns.

## Safety of tests

When tests use real providers/apply operations, account for:

- Cost.
- Unique naming.
- Environment isolation.
- Cleanup on failure.
- Parallelism/concurrency.
- Least-privilege credentials.
- Service quotas.
- Test duration.

Do not run destructive integration tests against production state/accounts/subscriptions.

## Example contract test shape

```hcl
mock_provider "example" {}

run "valid_contract" {
  command = plan

  variables {
    environment = "dev"
  }

  assert {
    condition     = output.environment == "dev"
    error_message = "Expected the module to expose the selected environment."
  }
}
```

Verify actual schema/feature compatibility before adapting examples to a real provider/version.

## CI order

A sensible baseline:

```text
fmt check
-> validate
-> lint (if used)
-> unit/mock tests
-> integration tests when justified
-> plan
```

Plan review/approval belongs to the deployment workflow, not merely test execution.

## What to test

Prioritize:

- Variable contracts and validation.
- Important naming/tagging/transformation logic.
- Conditional resource/module behavior.
- Security-sensitive defaults.
- Critical outputs.
- Upgrade compatibility and moved-address behavior for reusable modules.
- Provider integration where a provider/API semantic is business-critical.

Avoid brittle tests that merely restate every line of implementation.

## Third-party tools

TFLint and policy/security tools can add value, but do not make them mandatory when native Terraform validation/tests solve the actual need. Choose tools based on risk, ecosystem, and enforceable policy requirements.

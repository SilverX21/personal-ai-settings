---
last_reviewed: 2026-09-11
---

# Module design

## Mental model

A module is a cohesive Terraform configuration unit with an interface. The current working directory is the root module; called modules are child modules.

Good module boundaries describe infrastructure concepts and ownership boundaries, not one Terraform resource per module by default.

Examples:

```text
network
container-platform
database
application
monitoring
```

## When to create a module

Create a module when it provides meaningful reuse, composition, policy/guardrails, a stable interface, or isolates a cohesive infrastructure concept.

Do not create a wrapper module solely to rename every provider argument one-to-one. Do not abstract a one-off resource just because “everything must be a module.”

## Interface design

A good reusable module has:

- One clear purpose.
- A small public input surface.
- Explicit types and useful descriptions.
- Sensible defaults only where broadly safe.
- Validation for real contracts.
- Useful, stable outputs.
- Provider requirements without embedded provider configuration.
- Documentation and examples.
- Tests proportional to risk.

Avoid dozens of unrelated feature flags and giant “everything” modules.

## Composition

Prefer:

```text
root
├── network
├── compute
├── database
└── monitoring
```

when those are meaningful lifecycle/ownership concepts.

The root composes modules, passes outputs to inputs, and owns provider/backend/environment configuration.

## Provider boundaries

Reusable child modules declare provider requirements. Provider configuration blocks belong at the root/composition level. If the child needs alternate provider configurations, declare `configuration_aliases` and require the caller to pass them.

## Version constraints

Reusable modules should advertise the minimum Terraform/provider capabilities they require without unnecessarily preventing callers from selecting compatible newer provider versions.

Root modules should use intentional constraints and a committed lock file to make upgrades predictable.

For external registry modules, constrain versions so upgrades are deliberate. Remember `.terraform.lock.hcl` does not lock remote module versions.

## Standard structure

HashiCorp's standard module structure requires only a root module but commonly uses:

```text
README.md
main.tf
variables.tf
outputs.tf
```

Nested reusable modules live under `modules/`; examples can live under `examples/`. Do not create empty complexity mechanically for a tiny internal module.

## Registry naming

For public registry publishing, repository naming follows:

```text
terraform-<PROVIDER>-<NAME>
```

Do not force this naming convention onto local-only module folders.

## Inputs

Prefer stable, intention-revealing APIs. Do not expose raw provider schema wholesale unless the module's purpose truly is a thin provider abstraction.

Avoid passing entire arbitrary maps when a typed object can define a reliable contract. Conversely, do not create a huge deeply nested object that makes simple usage opaque.

## Outputs

Outputs are the supported integration contract. Expose what downstream composition needs—not every internal object attribute.

When splitting states, prefer explicit published interfaces/provider data sources rather than granting consumers broad state access.

## Tests

Test module logic, contracts, and critical behavior. Use native `terraform test` when sufficient. Mock providers for fast logic tests when appropriate, but include real-provider integration tests when actual API behavior is important.

## Breaking changes and migration

Changing resource addresses inside a published module can destroy/recreate user infrastructure unless you preserve identity with `moved` blocks. HashiCorp recommends retaining historical `moved` blocks in long-lived public modules because removing them can break upgrade paths.

Treat input/output removals, type changes, changed defaults, resource address changes, provider requirement changes, and behavior-changing lifecycle defaults as potentially breaking.

## Review checklist

- Does the module have one cohesive responsibility?
- Is every input necessary?
- Are types/descriptions/validations useful?
- Are defaults safe?
- Are outputs intentional?
- Are providers configured only by the caller?
- Are constraints compatible but intentional?
- Are resource identities stable?
- Are tests/documentation adequate?
- Can a simpler composition achieve the same result?

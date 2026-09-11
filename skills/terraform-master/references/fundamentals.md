---
last_reviewed: 2026-09-11
---

# Terraform fundamentals

## Mental model

Terraform describes **desired infrastructure state**. It does not execute blocks top-to-bottom like a shell script.

Think in this sequence:

```text
configuration
    -> dependency graph
    -> plan
    -> apply
    -> state
```

Terraform Core parses configuration, resolves dependencies and unknown values, asks providers to plan/perform remote operations, and records the resulting object bindings in state.

## Configuration, state, and real infrastructure

```text
Terraform configuration
        <->
Terraform state
        <->
Real infrastructure
```

Configuration expresses what should exist. State records Terraform's association between resource addresses and remote objects plus values Terraform needs for future operations. Providers observe and modify real systems.

A mismatch between configuration/state and reality may surface as **drift** during refresh/planning.

## Resources and data sources

- A managed `resource` asks Terraform to own lifecycle of a remote/local object.
- A `data` source reads information without taking ownership of the object's lifecycle.
- An `ephemeral` resource is a separate modern construct for provider-supported temporary values and has strict context/version rules; see `security-secrets.md`.

Do not use a resource when the intent is only discovery. Do not use a data source as a hidden orchestration step.

## Dependencies

Prefer implicit dependencies through references:

```hcl
resource "example_child" "main" {
  parent_id = example_parent.main.id
}
```

Terraform can infer the dependency because the child references the parent.

Use `depends_on` only for a real ordering dependency that cannot be represented by a data reference. Explicit dependencies can make plans more conservative, so they should be deliberate and documented.

## Unknown values

Many provider-computed values are unknown during plan and become known during apply. Do not confuse “known after apply” with an error. Design expressions so Terraform can still determine collection identity and resource addresses where necessary.

This is especially important for `for_each`: its keys must be known early enough for Terraform to identify instances.

## Standard workflow

```bash
terraform init
terraform fmt
terraform validate
terraform plan
terraform apply
```

For production, separate planning from applying and review the plan before approval.

`terraform init` initializes the working directory, backend, modules, and providers. `fmt` normalizes Terraform formatting. `validate` checks configuration syntax/internal consistency. `plan` previews actions. `apply` executes the approved plan and updates state.

## Plan symbols

Common plan actions:

- `+` create
- `~` update in place
- `-/+` replace
- `-` destroy

Treat replacement like destroy + create from an availability/data perspective. Pay special attention to databases, storage, identity, networking, DNS, encryption, and production compute.

## Drift and refresh

Terraform normally refreshes relevant remote object information during planning before proposing changes. Do not “fix drift” blindly: first decide whether Terraform or an external system is the intended owner of the changed attribute.

If another controller intentionally owns an attribute, model that ownership explicitly where possible. Use `ignore_changes` only when there is a real shared-ownership reason; do not use it to hide unexplained plans.

## Import

Import connects existing infrastructure to a Terraform resource address/state; it does not prove the configuration matches the remote object. After import, run a plan and reconcile differences carefully before applying.

## Destroy

Deletion is a real infrastructure operation, not cleanup of a configuration file. Removing a resource block normally makes Terraform plan destruction unless a supported state-removal/refactoring mechanism is used. Always review destructive plans deliberately.

## Troubleshooting phases

Classify the failure first:

1. Initialization/backend/provider installation.
2. Parsing/validation.
3. Planning/refresh/data lookup.
4. Apply/provider API operation.
5. State persistence/locking.

Then determine whether the message came from Terraform Core, a backend, a provider, or the remote platform API.

## Authoritative sources

See `sources.md` for Terraform language, CLI, state, and workflow links.

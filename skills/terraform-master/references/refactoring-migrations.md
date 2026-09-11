---
last_reviewed: 2026-09-11
---

# Refactoring, import, and migrations

## Principle

Preserve resource identity whenever the real infrastructure should remain the same. A Terraform address change should not automatically become a destroy/recreate event.

## `moved` blocks

For supported refactors, prefer declarative moves:

```hcl
moved {
  from = example_resource.old
  to   = example_resource.new
}
```

Use for renames, moving resources into modules, module call renames, and supported instance-address changes.

Always run and review a plan before apply. The plan should show address movement rather than replacement when the refactor is modeled correctly.

For long-lived reusable modules, retain historical `moved` blocks when users may upgrade from older versions. HashiCorp warns removing them can be a breaking change.

## `terraform state mv`

Use when declarative `moved` blocks cannot express the migration or when working with older Terraform constraints. It mutates state directly, so coordinate operators, confirm backend/workspace, and plan immediately afterward.

Prefer committed declarative migration history when possible.

## Import blocks

Modern configuration-driven import can be represented declaratively:

```hcl
import {
  to = example_resource.this
  id = "provider-object-id"
}
```

The exact import identifier/identity rules are provider-specific. Verify the resource's current Registry import documentation.

Import establishes Terraform's state association; it does not generate a guaranteed-correct configuration by itself.

After import:

1. Run `terraform plan`.
2. Compare desired configuration with remote settings.
3. Reconcile unexpected changes.
4. Apply only when the plan is understood.

## `removed` blocks

Current Terraform supports declarative removal from state without destroying infrastructure:

```hcl
removed {
  from = example_resource.this

  lifecycle {
    destroy = false
  }
}
```

At this review date, current HashiCorp docs recommend the `removed` block over `terraform state rm` when removing a managed object from state without destroying it because the declarative operation can be previewed in a plan.

Verify version compatibility for the target environment.

## `terraform state rm`

Use as a direct state operation only when the declarative route is unavailable or inappropriate. Once removed, Terraform no longer manages the object; a still-present resource block may cause Terraform to plan a new object with the same address.

## Backend migration

Backend/state migration is high risk because failure can strand or split authoritative state.

Before migration:

- Stop concurrent runs.
- Confirm source and destination backend/workspace.
- Verify permissions and locking behavior.
- Ensure recoverable source-state versioning/backups.
- Review Terraform's backend reinitialization/migration prompts/options for the current version.
- Validate the state after migration before normal applies resume.

Do not copy state manually between stores unless following a controlled recovery procedure and current documentation.

## Refactoring `count` to `for_each`

This changes instance addresses. Plan a mapping from old numeric indexes to new stable keys and preserve identity with `moved` blocks or controlled state moves.

Never switch the expression and hope Terraform infers the mapping.

## Module extraction

Moving existing root resources into a child module changes their addresses. Add `moved` blocks from old root addresses to the new `module.<name>...` addresses so Terraform can preserve ownership without recreation.

## Removal vs destroy

Decide explicitly:

- **Destroy:** the real infrastructure should be deleted.
- **Remove from state:** infrastructure should remain but Terraform should stop managing it.
- **Move:** Terraform should keep managing the same object at a new address.
- **Import:** Terraform should start managing an existing object.

Choosing the wrong operation can cause data loss or duplicated infrastructure.

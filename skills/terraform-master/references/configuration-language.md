---
last_reviewed: 2026-09-11
---

# Configuration language decision rules

## Variables

Prefer explicit contracts:

```hcl
variable "environment" {
  type        = string
  description = "Deployment environment."

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}
```

Validation should encode a meaningful module contract. Avoid duplicating every provider-side validation rule unless earlier failure materially improves safety or ergonomics.

Use `nullable = false` when `null` would violate the contract and a non-null value is truly required.

## Outputs

```hcl
output "endpoint" {
  description = "Application endpoint exposed to callers."
  value       = example_service.main.endpoint
}
```

Outputs are module API surface. Expose only useful values. Mark sensitive output values when appropriate, and see the security reference for persistence implications.

## Locals

Good uses: normalization, naming, derived values, tags, and transformations used in several places.

Bad use: one-to-one renaming with no semantic value.

## `for_each` vs `count`

Choose based on identity.

Use `for_each` when instances have stable natural keys:

```hcl
resource "example_service" "this" {
  for_each = var.services
  name     = each.key
}
```

Stable keys reduce accidental address churn when order changes.

Use `count` when positional identity is actually meaningful or for a simple optional singleton. Be cautious when a list drives long-lived resources: deleting/reordering a list element can shift indices and produce unintended changes.

Never use either construct mechanically.

## Dynamic blocks

Use only for repeatable nested provider blocks that must be generated from data. Keep iterators clear. If there are only a couple of known static cases, explicit blocks are often easier to maintain.

## Dependencies

Terraform builds dependencies from references. Prefer implicit edges.

`depends_on` is appropriate for hidden behavioral dependencies—for example, when one operation must complete before another even though no useful attribute flows between them. Document the reason.

## Lifecycle

Use lifecycle behavior carefully:

- `create_before_destroy`: useful when parallel old/new existence is supported and minimizes downtime; may be impossible for globally unique names or exclusive resources.
- `prevent_destroy`: a guardrail, not a substitute for backups/permissions. Removing the resource block also removes the rule, so it is not absolute protection.
- `ignore_changes`: declare intentional shared ownership of selected attributes; never use it as a blanket drift suppressor.
- `replace_triggered_by`: request replacement when specified managed-resource changes require it.

Inspect current lifecycle documentation for exact semantics before using advanced behavior.

## Preconditions, postconditions, and checks

Use:

- Variable validation for input contract validation.
- Preconditions for assumptions that must hold before a resource/data/output operation proceeds.
- Postconditions for expectations about a resulting resource/data value.
- `check` blocks for non-blocking infrastructure assertions after plan/apply; failed checks warn rather than block the operation.

See `testing-validation.md` for details and version requirements.

## Provisioners

Provisioners are an exceptional fallback. Prefer provider-native capabilities, image building, cloud-init/user data, configuration management, or an application deployment system.

If a provisioner is necessary, document why Terraform/provider-native alternatives are insufficient and design for failure/idempotency.

`terraform_data` can provide a managed lifecycle node without an external provider and can be used when provisioner triggering is genuinely required. Do not turn it into a generic scripting engine.

## Provider selection

Resource and data source arguments are provider API surface. Never guess them. When exact schema/behavior matters, consult the current Registry page for that resource/data source.

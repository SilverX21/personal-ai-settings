---
last_reviewed: 2026-09-11
---

# Style and conventions

## Principle

Optimize Terraform for the reviewer and future maintainer. Favor readability over minimum line count.

Use `terraform fmt` as the formatting authority rather than inventing a custom formatter style.

## Naming

Prefer:

- `snake_case` labels and names.
- Meaningful nouns for resource labels.
- Names that describe the role rather than restating the resource type.
- Consistent environment/domain terminology.

Avoid `thing`, `item`, `resource1`, `foo`, or names that encode transient implementation details.

## File organization

Conventional files may include:

```text
terraform.tf
providers.tf
variables.tf
locals.tf
main.tf
outputs.tf
data.tf
```

These are conventions, not requirements. Do not create empty files mechanically for a tiny configuration. Split files when it improves navigation; remember that Terraform loads all `.tf` files in a module directory together, so file order is not execution order.

For a reusable module, HashiCorp's standard structure emphasizes a root module and commonly `main.tf`, `variables.tf`, `outputs.tf`, plus a README. Complex modules can split resources by domain.

## Blocks and arguments

Keep related arguments together and use blank lines to separate conceptual groups. Let `terraform fmt` normalize alignment.

Comments should explain **why** an unusual decision exists, ownership boundaries, provider quirks, or migration constraints. Do not narrate obvious HCL.

## Variables

Meaningful input variables should normally have:

- An explicit type.
- A description.
- A default only when there is a genuinely safe/general default.
- Validation when the module contract can reject invalid input earlier and more clearly than the provider.

Do not turn every literal into a variable. Constants that are implementation details should remain internal.

Prefer a typed object when inputs form one cohesive concept; do not collapse unrelated settings into one giant object just to reduce variable count.

## Outputs

Expose the smallest useful public interface. Add descriptions. Mark sensitive outputs appropriately when they contain sensitive values, while remembering that sensitivity is primarily a presentation control.

Do not expose every internal resource ID “just in case.” Add outputs because callers need a stable contract.

## Locals

Use locals for derived values, repeated expressions, naming conventions, tag maps, and transformations.

Avoid layers such as `var.name -> local.name -> local.final_name` unless each layer adds real semantics. Excessive indirection makes plans and reviews harder to reason about.

## Dynamic blocks

Use `dynamic` blocks when the provider schema contains repeatable nested blocks whose number/shape is genuinely data-driven.

Prefer ordinary static blocks when the configuration is known. A little readable duplication can be better than nested dynamic blocks with difficult iterator logic.

## Interpolation and expressions

Use direct references such as `var.name` rather than unnecessary string interpolation where a string expression is not needed.

Prefer straightforward expressions. Extract a complex transformation into a well-named local when that improves readability, but do not move every expression into locals.

## Dependencies

Prefer references over `depends_on`. If explicit `depends_on` is required, comment on the non-data dependency it represents.

## Formatting and pre-commit minimum

```bash
terraform fmt -check -recursive
terraform validate
```

Add tests/linting based on project risk and needs. Do not require third-party tools when native Terraform checks already satisfy the requirement.

## Git hygiene

Commit Terraform code and the root configuration's `.terraform.lock.hcl` where applicable.

Do not commit:

- `terraform.tfstate` / backups.
- `.terraform/`.
- saved plan artifacts.
- `.tfvars` containing secrets.
- transient state lock-info files.

See `security-secrets.md` and `providers-versions.md`.

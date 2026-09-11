# terraform-developer

## Use for
Writing Terraform, composing resources and data sources, variables/outputs/locals, expressions, `for_each`/`count`, provider usage, lifecycle-aware implementation, and tests.

## Behavior
Prefer readable, explicit HCL and implicit dependencies. Keep the change small. Avoid premature abstraction, unnecessary variables, deep dynamic blocks, and provisioners unless no better Terraform/provider-native mechanism exists.

## Load
- `../references/configuration-language.md`
- `../references/style-conventions.md`
- `../references/providers-versions.md`
- `../references/testing-validation.md`
- provider reference when applicable

## Output
Provide the implementation, assumptions, safety notes, and verification commands. When exact provider arguments matter, verify current Registry documentation before writing them.

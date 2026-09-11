---
last_reviewed: 2026-09-11
---

# terraform-master references

This directory is the progressive-disclosure knowledge layer for `terraform-master`.

## Rules

- Current official documentation overrides these summaries.
- Stable mental models can be answered primarily from local references.
- Changing information must be re-verified against official HashiCorp/Registry documentation.
- Keep references focused: mental models, decision rules, pitfalls, commands, and authoritative links.
- Do not copy large documentation sections.
- Update `last_reviewed` only after actually reviewing the relevant official sources.

## Routing

| Topic | Reference |
|---|---|
| Terraform mental model/workflow | `fundamentals.md` |
| HCL style and file organization | `style-conventions.md` |
| Expressions, variables, outputs, dependencies, lifecycle | `configuration-language.md` |
| Terraform/provider constraints and lock file | `providers-versions.md` |
| Module design | `modules.md` |
| State, backends, locking, workspaces | `state-backends.md` |
| Tests and validation | `testing-validation.md` |
| Credentials, sensitive/ephemeral data, supply chain | `security-secrets.md` |
| CI/CD workflow and saved plans | `workflows-cicd.md` |
| Imports, moves, removed blocks, migrations | `refactoring-migrations.md` |
| AWS Terraform/provider boundary | `providers/aws.md` |
| Azure Terraform/provider boundary | `providers/azure.md` |
| Official documentation index | `sources.md` |

---
last_reviewed: 2026-09-11
---

# Authoritative sources

Official HashiCorp documentation is the primary source. Provider-specific resource/argument behavior comes from the official Terraform Registry provider docs, with cloud-provider documentation used for platform semantics.

At this review date, HashiCorp's Terraform documentation navigation labels **v1.16.x** as latest. Treat that as review metadata only; verify the current version again whenever “latest” or feature compatibility matters.

## Terraform language and style

- Language: https://developer.hashicorp.com/terraform/language
- Style guide: https://developer.hashicorp.com/terraform/language/style
- Blocks/reference: https://developer.hashicorp.com/terraform/language/block
- Expressions: https://developer.hashicorp.com/terraform/language/expressions
- Meta-arguments: https://developer.hashicorp.com/terraform/language/meta-arguments

## CLI and workflow

- CLI: https://developer.hashicorp.com/terraform/cli
- `init`: https://developer.hashicorp.com/terraform/cli/commands/init
- `fmt`: https://developer.hashicorp.com/terraform/cli/commands/fmt
- `validate`: https://developer.hashicorp.com/terraform/cli/commands/validate
- `plan`: https://developer.hashicorp.com/terraform/cli/commands/plan
- `apply`: https://developer.hashicorp.com/terraform/cli/commands/apply

## Providers, versions, and lock file

- Provider requirements: https://developer.hashicorp.com/terraform/language/providers/requirements
- Provider configuration: https://developer.hashicorp.com/terraform/language/block/provider
- Version constraints: https://developer.hashicorp.com/terraform/language/expressions/version-constraints
- Dependency lock file: https://developer.hashicorp.com/terraform/language/files/dependency-lock
- Terraform Registry: https://registry.terraform.io/

## Modules

- Modules overview: https://developer.hashicorp.com/terraform/language/modules
- Creating modules: https://developer.hashicorp.com/terraform/language/modules/develop
- Standard structure: https://developer.hashicorp.com/terraform/language/modules/develop/structure
- Providers within modules: https://developer.hashicorp.com/terraform/language/modules/develop/providers
- Refactoring modules: https://developer.hashicorp.com/terraform/language/modules/develop/refactoring
- Registry publishing: https://developer.hashicorp.com/terraform/registry/modules/publish

## State and backends

- State: https://developer.hashicorp.com/terraform/language/state
- Remote state: https://developer.hashicorp.com/terraform/language/state/remote
- Backends: https://developer.hashicorp.com/terraform/language/backend
- State storage/locking: https://developer.hashicorp.com/terraform/language/state/backends
- State locking: https://developer.hashicorp.com/terraform/language/state/locking
- Remote-state data: https://developer.hashicorp.com/terraform/language/state/remote-state-data
- CLI workspaces: https://developer.hashicorp.com/terraform/cli/workspaces
- S3 backend: https://developer.hashicorp.com/terraform/language/backend/s3
- AzureRM backend: https://developer.hashicorp.com/terraform/language/backend/azurerm

## Testing and validation

- Terraform tests: https://developer.hashicorp.com/terraform/language/tests
- Mocking: https://developer.hashicorp.com/terraform/language/tests/mocking
- Validate infrastructure: https://developer.hashicorp.com/terraform/language/validate
- `check` block: https://developer.hashicorp.com/terraform/language/block/check

## Sensitive and ephemeral data

- Manage sensitive data: https://developer.hashicorp.com/terraform/language/manage-sensitive-data
- Ephemeral values: https://developer.hashicorp.com/terraform/language/manage-sensitive-data/ephemeral
- Write-only arguments: https://developer.hashicorp.com/terraform/language/manage-sensitive-data/write-only
- Variable block (`sensitive`, `ephemeral`): https://developer.hashicorp.com/terraform/language/block/variable
- Ephemeral block: https://developer.hashicorp.com/terraform/language/block/ephemeral

## Refactoring, import, and removal

- Import block: https://developer.hashicorp.com/terraform/language/block/import
- Import existing resources: https://developer.hashicorp.com/terraform/language/import
- `moved`-based refactoring: https://developer.hashicorp.com/terraform/language/modules/develop/refactoring
- `removed` block: https://developer.hashicorp.com/terraform/language/block/removed
- Remove from state: https://developer.hashicorp.com/terraform/language/state/remove

## HCP Terraform

- HCP Terraform overview: https://developer.hashicorp.com/terraform/cloud-docs
- Workspaces: https://developer.hashicorp.com/terraform/cloud-docs/workspaces
- Workspace state: https://developer.hashicorp.com/terraform/cloud-docs/workspaces/state
- Security model: https://developer.hashicorp.com/terraform/cloud-docs/architectural-details/security-model

## AWS provider

- AWS provider: https://registry.terraform.io/providers/hashicorp/aws/latest/docs
- S3 backend: https://developer.hashicorp.com/terraform/language/backend/s3
- AWS IAM temporary credentials: https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp.html

## Azure providers

- AzureRM provider: https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs
- AzAPI provider: https://registry.terraform.io/providers/Azure/azapi/latest/docs
- AzureRM backend: https://developer.hashicorp.com/terraform/language/backend/azurerm
- Microsoft Terraform authentication guidance: https://learn.microsoft.com/azure/developer/terraform/authenticate/authenticate-to-azure

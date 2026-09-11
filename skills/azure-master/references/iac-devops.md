---
last_reviewed: 2026-09-11
---

# Infrastructure as Code, Azure CLI, and CI/CD

Use for language-agnostic Azure provisioning, operational automation, and delivery pipelines.

## Infrastructure as Code

Prefer Bicep for Azure-native IaC when the project has no existing competing standard.

Use Terraform or another established IaC tool when the project or organization already standardizes on it.

Keep modules aligned with real ownership and lifecycle boundaries. Avoid excessive fragmentation into tiny modules that make deployments harder to understand.

Official docs: https://learn.microsoft.com/azure/azure-resource-manager/bicep/

## Azure CLI

For commands:

- Use placeholders for subscription IDs, resource names, resource groups, tenant IDs, and regions that are not known.
- Make required login and subscription context explicit when it matters.
- Verify syntax against current CLI documentation for high-impact or version-sensitive operations.
- Add a read-only verification command after changes when practical.

Official docs: https://learn.microsoft.com/cli/azure/

## CI/CD

Prefer the repository's existing CI/CD platform.

Common choices include:

- GitHub Actions for GitHub-hosted projects.
- Azure Pipelines for Azure DevOps-hosted projects.

Security preference:

- Federated/workload identity authentication where supported.
- Avoid long-lived client secrets, service principal passwords, or publish profiles when a stronger supported mechanism fits.

A deployment plan should normally include:

1. Validate and test.
2. Deploy infrastructure changes.
3. Deploy application changes.
4. Verify health and expected behavior.
5. Roll back or recover if verification fails.

## Language boundary

This file deliberately contains no application-language-specific SDK patterns. For code that consumes Azure services, load the matching file under `references/languages/`.

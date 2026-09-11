---
last_reviewed: 2026-09-11
---

# Terraform + AWS provider boundary

This file covers how Terraform interacts with AWS. It does not replace AWS platform architecture knowledge.

## Source priority

1. HashiCorp Terraform language/core docs.
2. Current `hashicorp/aws` Registry documentation.
3. AWS official documentation for IAM/service API semantics.

Never guess AWS resource arguments from memory.

## Provider requirement and configuration

Declare the provider source/version constraint in `required_providers`; configure region/authentication in root provider blocks.

Do not place static access keys in the provider block. Current AWS Provider docs explicitly warn against hardcoded credentials.

## Authentication

Prefer provider/SDK-supported credential chains and short-lived identity:

- IAM roles on AWS compute.
- Web identity / OIDC federation.
- AssumeRole for cross-account access.
- Container/instance profile credentials.
- Named profiles / environment credentials for local development when appropriate.

The current AWS provider supports role assumption and web-identity/OIDC flows. Exact arguments and precedence can change; verify the Registry docs before implementing.

## Regions and aliases

Use a sensible default provider configuration when one AWS region/account context is primary.

Use aliases only when the Terraform composition genuinely needs multiple provider configurations, such as multiple regions or identities/accounts:

```hcl
provider "aws" {
  region = var.primary_region
}

provider "aws" {
  alias  = "secondary"
  region = var.secondary_region
}
```

Pass aliases explicitly to child modules that declare the corresponding `configuration_aliases`.

Do not generate large matrices of aliases if independently composed root modules would create clearer ownership/state boundaries.

## Account safety

The AWS provider exposes guardrails such as allowed/forbidden account ID configuration. Consider account-target guardrails for high-risk multi-account automation, but verify current provider schema before use.

## Default tags

The AWS provider supports provider-level default tags. They can reduce repeated tagging when the same organization/environment tags truly apply broadly.

Do not hide important resource-specific tags behind confusing precedence. Verify current provider behavior for `tags`/`tags_all` and default-tag merging before relying on edge cases.

## S3 remote state

Current HashiCorp S3 backend docs state:

- State can be stored in S3.
- S3-native state locking is opt-in via `use_lockfile = true`.
- DynamoDB-based locking is deprecated and planned for removal in a future minor version.
- Bucket versioning is strongly recommended for recovery.
- Credentials should be supplied through environment/shared/workload identity mechanisms rather than hardcoded backend config.

This is a Terraform backend behavior, not AWS Provider resource behavior. Do not require an `aws` provider merely because the S3 backend is used.

Use encryption, restrictive bucket/object permissions, public-access prevention, versioning, and appropriate audit controls according to AWS security requirements. Exact IAM permissions should be derived from the current HashiCorp backend docs and AWS IAM/service docs.

## Cross-account patterns

From the Terraform perspective:

- Root/composition owns provider identities and aliases.
- Reusable modules receive provider configurations rather than embedding account credentials.
- Prefer explicit state boundaries when accounts have different ownership/permissions/blast radius.
- Use AssumeRole/OIDC federation rather than long-lived keys where possible.

The AWS-specific design of organizations, network topology, ECS/EKS behavior, IAM policy semantics, etc. belongs in AWS platform guidance.

## Troubleshooting

For AWS provider errors, separate:

- Terraform/provider initialization.
- Credential discovery.
- STS/AssumeRole failure.
- IAM authorization denial.
- Wrong account/region.
- Service API validation/quota/eventual-consistency issue.
- Provider bug/version regression.
- State drift/address issue.

Capture the exact provider error and resource address, then verify the current Registry resource docs and AWS API semantics.

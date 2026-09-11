---
last_reviewed: 2026-09-11
---

# AWS identity and security

Use for IAM, human/workload identity, authorization, secrets, encryption, and security posture.

## Root user

The AWS account root user has complete account-level power and should not be used for routine administration or applications.

Current AWS guidance emphasizes protecting root credentials, enabling MFA, minimizing root use, and avoiding root access keys.

Docs: https://docs.aws.amazon.com/IAM/latest/UserGuide/root-user-best-practices.html

## Human access

Prefer federation and temporary credentials. For multi-account/workforce access, IAM Identity Center is the standard AWS service for centralized workforce access.

Avoid creating long-lived IAM users for humans unless the use case genuinely requires them.

Docs: https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html

## Workload identity

Prefer IAM roles and temporary credentials for AWS-hosted workloads:

- EC2 instance profile/role.
- ECS task role.
- Lambda execution role.
- EKS workload identity mechanisms appropriate to the cluster/design.

Do not embed access keys in code, images, or committed configuration.

## IAM authorization mental model

Reason about:

identity -> credentials/session -> policy evaluation -> action -> resource

Relevant policy layers can include:

- Identity-based policy.
- Resource-based policy.
- Role trust policy.
- Service Control Policy (SCP).
- Permissions boundary.
- Session policy.
- Service-specific controls.

An explicit deny overrides an allow in normal IAM evaluation. When debugging authorization, identify every applicable policy boundary instead of blindly adding permissions.

Docs: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html

## Least privilege

Start from required actions/resources. Use conditions and resource scoping where supported. AWS IAM Access Analyzer can help validate/generate policies based on access patterns.

## Secrets

### Secrets Manager

Managed secret storage/rotation capabilities for passwords, API keys, and other secrets.

### Systems Manager Parameter Store

Configuration/parameter storage with secure-string capability. Selection depends on required features, secret lifecycle, integration, and cost.

Never store secrets in source control.

## KMS

AWS Key Management Service manages cryptographic keys and integrates with many AWS services. Understand both IAM permissions and KMS key policies/grants where relevant.

Docs: https://docs.aws.amazon.com/kms/latest/developerguide/overview.html

## Security services

At a conceptual/review level, know:

- GuardDuty: threat detection.
- Security Hub: security findings/posture aggregation.
- AWS Config: configuration inventory/rules/history.
- WAF: web request filtering.
- CloudTrail: API activity audit trail.

Verify exact current capabilities before detailed recommendations.

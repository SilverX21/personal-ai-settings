---
last_reviewed: 2026-09-11
---

# AWS governance and cost

Use for accounts, Organizations, policies/guardrails, tagging, budgets, quotas, and cost optimization.

## AWS Organizations

Service for centrally managing multiple AWS accounts.

Concepts:

- Organization.
- Management account.
- Member accounts.
- Organizational Units (OUs).
- Service Control Policies (SCPs).

SCPs define maximum permission guardrails for accounts/OUs; they do not grant permissions themselves.

Docs: https://docs.aws.amazon.com/organizations/

## Account strategy

Use multiple accounts when isolation, ownership, billing, blast-radius, security, or lifecycle needs justify it. Do not create a complex multi-account topology merely because enterprise examples use one.

## Tags

Use tags for ownership, environment, application, cost allocation, automation, and governance where appropriate.

Do not assume every AWS service supports tags identically.

## Service Quotas

Many AWS services have quotas that can affect scaling/deployments. Verify current quotas and whether they are adjustable.

Docs: https://docs.aws.amazon.com/servicequotas/

## Cost tooling

- Cost Explorer: analyze historical/current cost and usage.
- AWS Budgets: budget thresholds/alerts/actions where supported.
- Cost allocation tags: organize attributable spend.
- Pricing Calculator: model estimated architecture cost.

## Common cost drivers

- EC2/ECS/Fargate runtime and sizing.
- RDS/Aurora sizing/storage/HA.
- NAT Gateway.
- Elastic Load Balancing.
- Public IPv4 usage where applicable.
- Cross-AZ / cross-Region / internet data transfer.
- CloudWatch logs/metrics/retention.
- S3 storage class and request patterns.
- DynamoDB usage/capacity.
- Backups/snapshots.
- Idle resources.

Never quote exact current pricing without checking official pricing sources.

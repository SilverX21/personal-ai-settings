---
last_reviewed: 2026-09-11
---

# Azure governance and cost

Use for subscriptions, resource groups, tags, Policy, resource locks, budgets, and cost optimization.

## Governance tools

- Management groups: organize subscriptions and apply governance at higher scope.
- Subscriptions: management, access, quota, and billing boundaries.
- Resource groups: logical lifecycle/management containers for resources.
- Tags: metadata for organization, ownership, automation, and cost reporting; not an authorization boundary.
- Azure Policy: evaluate/enforce organizational rules at scale.
- Resource locks: protect against accidental deletion/modification; use carefully because they can block legitimate operations.

Azure Policy docs: https://learn.microsoft.com/azure/governance/policy/

## Cost discipline

For exact cost, use current official Azure pricing and calculator data.

Material cost drivers often include:

- Compute SKU/runtime.
- Database service tier.
- Storage redundancy/capacity/transactions.
- Data transfer.
- NAT/networking/application delivery services.
- Log ingestion and retention.
- High-availability / zone / geo-redundancy choices.
- Idle or orphaned resources.

Use budgets and Cost Management for visibility/alerts where appropriate.

Official docs:

- Cost Management: https://learn.microsoft.com/azure/cost-management-billing/
- Pricing: https://azure.microsoft.com/pricing/
- Pricing calculator: https://azure.microsoft.com/pricing/calculator/

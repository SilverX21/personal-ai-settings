---
last_reviewed: 2026-09-11
---

# Azure fundamentals

Use for beginner Azure learning, AZ-900 concepts, resource organization, cloud concepts, and global infrastructure.

## Mental models

### Cloud service responsibility

- **IaaS**: customer manages more of the OS/runtime/application stack.
- **PaaS**: Azure manages more platform infrastructure; customer focuses more on application/data/configuration.
- **SaaS**: provider operates the application; customer primarily configures and uses it.

Do not reduce the shared responsibility model to a single fixed table; responsibility depends on the service model and workload.

### Resource hierarchy

A useful management hierarchy is:

```text
Management Group
  -> Subscription
    -> Resource Group
      -> Resource
```

- Management groups organize subscriptions for governance at scale.
- Subscriptions are management/billing/access boundaries.
- Resource groups are logical containers for resources that commonly share lifecycle or management concerns.
- Resources are individual Azure service instances.

### Regions and availability zones

- An Azure region is a geographic area containing Azure datacenter infrastructure.
- Availability zones are physically separate groups of datacenters within a region designed to reduce correlated failures.
- Not every service, SKU, or region has identical zone/feature support; verify current service documentation.

## Core learning outcomes

Understand:

- Public/private/hybrid cloud.
- CapEx vs OpEx.
- Consumption-based pricing.
- Scalability vs elasticity.
- High availability vs disaster recovery.
- Reliability and fault domains at a conceptual level.
- Shared responsibility.
- Resource hierarchy and governance scope.
- Azure Portal, Cloud Shell, CLI, PowerShell, ARM/Bicep at a conceptual level.

## Official sources

- AZ-900 study guide: https://learn.microsoft.com/credentials/certifications/resources/study-guides/az-900
- Azure documentation: https://learn.microsoft.com/azure/

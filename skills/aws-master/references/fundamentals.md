---
last_reviewed: 2026-09-11
---

# AWS fundamentals

Use for Cloud Practitioner-level concepts and foundational AWS mental models.

## Cloud concepts

Understand:

- IaaS, PaaS, SaaS.
- Public/private/hybrid cloud concepts.
- Elasticity and scalability.
- High availability vs fault tolerance.
- Disaster recovery vs high availability.
- Consumption-based pricing and variable cost.
- Shared Responsibility Model.

The AWS Shared Responsibility Model changes with the service. In general, AWS is responsible for security **of** the cloud, while customers retain responsibility for security **in** the cloud. Managed services shift more operational responsibility to AWS, but customers still own data, access, configuration, and workload-level security appropriate to the service.

Official overview: https://aws.amazon.com/compliance/shared-responsibility-model/

## Global infrastructure

### Region

A geographic area containing multiple isolated Availability Zones.

### Availability Zone

One or more discrete data centers with independent power/networking, connected with low-latency links within a Region. Use multiple AZs when workload availability requirements justify it.

### Edge locations

Used by global/edge services such as CloudFront and Route 53 to provide low-latency delivery/resolution capabilities.

Docs: https://aws.amazon.com/about-aws/global-infrastructure/

## Scope awareness

AWS resources can be:

- Global.
- Regional.
- Availability-Zone scoped.

Do not assume every service/resource has the same scope. Region selection affects latency, compliance/data residency, feature availability, architecture, and cost.

## AWS account mental model

An AWS account is a strong isolation and billing/ownership boundary. Organizations can group accounts and apply governance at scale.

Do not confuse:

- AWS account boundary.
- IAM identity/authorization.
- VPC network boundary.
- Tag/resource grouping.

## Cloud Practitioner domains

The current CLF-C02 guide groups content into:

1. Cloud Concepts.
2. Security and Compliance.
3. Cloud Technology and Services.
4. Billing, Pricing, and Support.

Official exam guide: https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02.html

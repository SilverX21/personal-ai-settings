# AWS cost

You cannot optimize what you cannot attribute. Visibility first, then architecture, then
commitments — in that order. Buying a Savings Plan before right-sizing locks in the waste.

## Visibility

- **Cost allocation tags activated** in Billing (a tag does nothing for cost reporting until
  activated) — see the tagging section in `SKILL.md`.
- **AWS Budgets** with alerts per account and per major tag, at 80% and 100% of forecast.
- **Cost Anomaly Detection** enabled — it catches the runaway job that a monthly review
  would find four weeks late.
- **Infracost on pull requests**, so cost enters the conversation while the change is still
  cheap to alter.
- Separate accounts give per-account attribution for free, with no tagging discipline
  required.

Track **unit cost** — per tenant, per request, per GB processed — not just total spend.
Total spend rising while unit cost falls is a business succeeding.

## Architecture-level savings

These beat every commitment discount, because they remove the spend rather than discount
it.

**Graviton.** ARM-based instances deliver roughly **40% better price-performance** than
equivalent x86. Available for EC2, RDS, Aurora, ElastiCache, OpenSearch, and Lambda. For
most containerized and managed-service workloads, switching is a change of instance type.
**Migrate to Graviton before purchasing commitments** — otherwise you commit at the higher
x86 rate and lose the saving you were about to make.

**NAT gateway data processing** — roughly $0.045/GB on *all* traffic, including traffic to
AWS services in the same region. Mitigations, in order:
1. **Gateway endpoints for S3 and DynamoDB.** Free, and often the single largest line item
   removed.
2. **Interface endpoints** for ECR, Secrets Manager, SSM, CloudWatch Logs, STS.
3. Consolidate to one NAT gateway in non-production (accepting the AZ risk).

**Data transfer generally.** Cross-AZ traffic is charged. Cross-region is charged more.
Egress to the internet is charged most. CloudFront egress is cheaper than direct S3 or EC2
egress — putting CloudFront in front of a public asset path frequently pays for itself.

**Storage lifecycle.** S3 without a lifecycle policy grows forever. Set transitions to IA
and Glacier and, where appropriate, expiration — at bucket creation, in the same module.
Same for **CloudWatch Logs retention**, which defaults to *never expire* and quietly becomes
a top-ten line item.

**Right-size before committing.** Compute Optimizer recommendations, then act on them.
Over-provisioned instances under a Savings Plan are waste you have now prepaid for.

**Turn off non-production out of hours.** Dev and staging running nights and weekends is
roughly 70% waste for the same capability.

## Commitments

Apply only to steady-state, right-sized, Graviton-migrated usage.

| Instrument | Discount | Flexibility |
|---|---|---|
| Compute Savings Plans | up to ~66% | Any region, instance family, EC2/Fargate/Lambda |
| EC2 Instance Savings Plans | up to ~72% | Locked to a family in a region |
| Reserved Instances | up to ~72% | Locked; but the only option for some services |
| Spot | up to ~90% | Interruptible — batch, CI, stateless, fault-tolerant only |

**The most common gap: Compute Savings Plans do not cover RDS, ElastiCache, OpenSearch,
Redshift, or DynamoDB.** Those need their own Reserved Instances or reserved capacity, and
teams routinely leave the majority of their database compute discount unclaimed because
they assume the compute plan covered it.

Start with a 1-year, no-upfront Compute Savings Plan sized to your **trough**, not your
average. Under-commit deliberately — unused commitment is a pure loss, while uncovered
usage merely pays on-demand.

## Reviewing a design for cost

Ask, in order:

1. **What is running that nobody uses?** Idle load balancers, unattached EBS volumes,
   unused Elastic IPs, old snapshots, forgotten dev environments, NAT gateways in VPCs with
   no traffic.
2. **What is over-provisioned?** Compare actual utilization against provisioned capacity.
3. **What crosses a boundary it does not need to?** Cross-AZ chatter, NAT for traffic that
   could use an endpoint, egress that could go via CloudFront.
4. **What retains data forever?** Logs, snapshots, S3 without lifecycle rules.
5. **What could be Graviton and is not?**
6. **What is steady-state and uncommitted?**

Do not skip to step 6. It is the one that feels like progress and delivers the least.

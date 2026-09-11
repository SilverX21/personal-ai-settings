# Post-task hook

Before finalizing substantial AWS work, check the following.

## Correctness

- Does the recommendation actually meet the stated requirement?
- Were service-specific IAM/networking semantics verified where they matter?
- Are commands/code using placeholders rather than invented account IDs/ARNs?
- If language-specific code is present, was the matching language reference used?

## Security

- Did the solution introduce long-lived AWS access keys unnecessarily?
- Is least privilege preserved?
- Did troubleshooting unnecessarily open Security Groups/NACLs/public access?
- Are secrets kept out of source control/logs?
- Is root-user use avoided except for root-only tasks?

## Reliability and rollback

- For production/high-impact changes, is rollback/recovery explicit?
- Could CloudFormation/CDK/Terraform replace a stateful resource?
- Are data migrations/compatibility concerns handled?

## Networking

- If connectivity changed, were DNS, routes, gateways/endpoints, Security Groups, NACLs, and target configuration considered as a path?

## Observability

- Is there a way to verify success using logs, metrics, traces, health checks, or CloudTrail evidence?

## Cost

- Did the change add material cost drivers such as NAT Gateway, load balancers, extra AZs/Regions, databases, public IPv4, or high-volume logs?
- Never present exact pricing from memory.

## Freshness

Verify date-sensitive/high-impact facts against current official AWS documentation before presenting them as current.

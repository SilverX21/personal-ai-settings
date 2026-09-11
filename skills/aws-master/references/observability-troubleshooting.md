---
last_reviewed: 2026-09-11
---

# AWS observability and troubleshooting

Use for logs, metrics, traces, auditing, incidents, and diagnosis.

## CloudWatch

Core AWS monitoring/observability service family for metrics, logs, alarms, dashboards, and related capabilities.

Use it to answer questions such as:

- Is the service healthy?
- Is latency/error rate increasing?
- Are queues backing up?
- What do application/platform logs show?
- Should an alarm trigger?

Docs: https://docs.aws.amazon.com/cloudwatch/

## CloudTrail

Records AWS account/API activity for auditing, governance, and investigation.

Mental shortcut:

- CloudWatch: workload/service observability.
- CloudTrail: who/what called AWS APIs and what happened at the account/control-plane level.

Docs: https://docs.aws.amazon.com/awscloudtrail/

## Tracing

AWS X-Ray and OpenTelemetry tooling can provide distributed trace context depending on the workload and current service integrations.

Prefer current OpenTelemetry guidance for instrumenting modern applications when it fits the stack.

## AWS Health

Use when a service/account-specific AWS event may explain the incident.

## Troubleshooting workflow

1. Define the symptom precisely.
2. Establish time window and scope.
3. Check recent deployments/configuration/IAM/network changes.
4. Inspect CloudWatch metrics/logs and service-specific telemetry.
5. Identify the calling principal/session.
6. Evaluate IAM/resource-policy controls.
7. Trace DNS/network path.
8. Inspect configuration/secrets/dependencies.
9. Check CloudTrail for relevant API/control-plane activity.
10. Check quotas/throttling/service health.
11. Make the smallest reversible fix.
12. Verify with the original symptom and telemetry.

Avoid deleting/recreating resources before preserving evidence.

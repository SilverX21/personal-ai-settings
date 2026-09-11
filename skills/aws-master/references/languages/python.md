---
last_reviewed: 2026-09-11
---

# Python on AWS

Use for Python applications, Boto3/Botocore, Lambda Python, and Python-specific AWS integration patterns.

## Boto3

Boto3 is the AWS SDK for Python.

Official docs: https://boto3.amazonaws.com/v1/documentation/api/latest/index.html

## Credentials

Prefer Boto3/Botocore's standard credential-provider mechanisms and IAM roles/temporary credentials over embedded access keys.

For AWS-hosted workloads, use the service's workload role mechanism such as Lambda execution role or ECS task role.

## Python defaults

Prefer:

- Virtual environments and explicit dependency management.
- Reused clients/resources where appropriate instead of unnecessary recreation.
- Clear timeouts/retry behavior for network calls where configurable.
- Structured logging and OpenTelemetry when relevant.
- IAM roles and least-privilege policies over stored credentials.
- Clear separation between AWS integration code and domain/application logic.

For Lambda, initialize reusable SDK clients outside the handler when appropriate so execution-environment reuse can benefit subsequent invocations.

---
last_reviewed: 2026-09-11
---

# .NET / C# on AWS

Use for C#, ASP.NET Core, .NET Worker Services, AWS SDK for .NET, Lambda .NET, and CDK with C#.

## AWS SDK for .NET

Prefer current AWS SDK for .NET packages for the target service. Reuse clients according to SDK/.NET lifecycle guidance instead of recreating service clients per request without a reason.

Official docs: https://docs.aws.amazon.com/sdk-for-net/

## Credentials

Prefer the AWS SDK default credential-provider chain rather than manually injecting static access keys.

For AWS-hosted workloads, use IAM roles and temporary credentials:

- ECS task role.
- EC2 instance profile/role.
- Lambda execution role.

For local development, use supported local credential mechanisms/profiles/federated sign-in and make the expected source explicit when troubleshooting.

## Application patterns

Prefer:

- Dependency injection.
- Strongly typed options/configuration.
- Async APIs.
- `CancellationToken` where meaningful.
- Structured logging.
- OpenTelemetry when relevant.
- Reused AWS SDK clients.
- IAM roles and least-privilege policies over stored credentials.

Avoid unnecessary wrapper abstractions around AWS SDK clients unless they create a genuine domain/testability/portability boundary.

## Lambda

Use current AWS Lambda .NET runtime/package guidance. Pay attention to cold-start-sensitive initialization and reuse expensive clients/resources across invocations where supported.

## AWS CDK with C#

CDK supports .NET/C#. Use it when code-based IaC fits the team/project, while remembering that it synthesizes CloudFormation and underlying CloudFormation replacement/update semantics still matter.

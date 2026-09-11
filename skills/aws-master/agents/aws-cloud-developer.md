# AWS Cloud Developer

Use this role for application development on AWS, SDK usage, hosting, messaging, configuration, secrets, deployment, and CI/CD across programming languages.

## Language selection

Keep service selection and AWS architecture language agnostic until implementation details matter.

When code is required:

1. Use the user's explicitly requested language/framework.
2. Otherwise use the language established by the current project.
3. Load the matching file under `references/languages/`.
4. If no matching reference exists, keep the AWS reasoning language agnostic and use current official AWS developer documentation for the requested language.

Bundled references cover .NET/C#, JavaScript/TypeScript/Node.js including NestJS, and Python.

## Defaults

- Prefer managed AWS services when they satisfy the requirement.
- Prefer IAM roles and temporary credentials over embedded access keys.
- Prefer idiomatic dependency/configuration/client-lifecycle patterns for the selected language/framework.
- Prefer the project's existing IaC standard; for AWS-native work consider CloudFormation or CDK.
- Prefer OIDC/federated CI/CD authentication over long-lived AWS access keys where supported.

## Common service choices

- ECS/Fargate: containerized workloads without Kubernetes operations.
- Lambda: event-driven/serverless execution when its execution model fits.
- EC2: workloads requiring OS-level control or self-managed infrastructure.
- SQS: durable queueing and decoupling.
- SNS: pub/sub fan-out notifications.
- EventBridge: event routing and integration.
- S3: object storage.
- RDS/Aurora: relational workloads.
- DynamoDB: key-value/document workloads when its access model fits.
- Secrets Manager / Parameter Store: secrets and configuration.
- CloudWatch / X-Ray / OpenTelemetry: application and platform observability.

## Development review checklist

Check:

- Authentication model and credential source.
- IAM authorization and resource policies.
- Retry and transient-fault handling.
- Idempotency for message/event processing.
- Configuration and secret handling.
- Observability.
- Timeouts and cancellation/abort behavior appropriate to the language.
- SDK client lifetime / connection management.
- Deployment and rollback.
- Cost-sensitive design choices.

Avoid adding abstractions merely to wrap AWS SDK calls unless they create a genuine boundary.

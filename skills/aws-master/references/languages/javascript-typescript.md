---
last_reviewed: 2026-09-11
---

# JavaScript / TypeScript / Node.js / NestJS on AWS

Use for Node.js applications written in JavaScript or TypeScript, including NestJS, AWS SDK for JavaScript v3, Lambda Node.js, and CDK TypeScript.

## AWS SDK for JavaScript v3

Prefer modular v3 clients/commands for the target AWS service.

Official docs: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/welcome.html

## Credentials

Prefer the SDK's default credential-provider chain and temporary credentials over static access keys.

For AWS-hosted workloads, use IAM roles such as ECS task roles or Lambda execution roles.

## TypeScript / Node.js defaults

Prefer:

- TypeScript when the project uses it.
- Explicit configuration validation.
- Async/await with proper error handling.
- Reused service clients rather than creating them on every request.
- Structured logging and OpenTelemetry when relevant.
- IAM roles and least-privilege policies over stored credentials.

## NestJS

Treat NestJS as part of TypeScript/Node.js guidance.

For NestJS integrations:

- Register AWS SDK clients as providers/modules when DI/client reuse benefits the application.
- Keep AWS configuration in dedicated configuration providers/modules.
- Validate required Region, endpoints, ARNs/names, and non-secret settings at startup.
- Keep secrets/access keys out of source-controlled configuration.
- Avoid constructing AWS SDK clients inside controllers or per request.
- Keep AWS infrastructure concerns separate from domain/application logic.

## Common packages

AWS SDK v3 packages are service-specific, for example:

- `@aws-sdk/client-s3`
- `@aws-sdk/client-sqs`
- `@aws-sdk/client-dynamodb`
- `@aws-sdk/client-secrets-manager`

Always verify current package/API usage against official service documentation.

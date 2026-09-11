---
last_reviewed: 2026-09-11
---

# JavaScript / TypeScript / Node.js / NestJS on Azure

Use for Node.js applications written in JavaScript or TypeScript, including NestJS applications, Azure SDK for JavaScript, and Node-specific Azure integration patterns.

## Azure SDK for JavaScript

Prefer current `@azure/*` packages for the target Azure service.

Azure developer documentation: https://learn.microsoft.com/azure/developer/

## Authentication

Prefer Microsoft Entra ID and token-based authentication when supported.

Use `@azure/identity` and `DefaultAzureCredential` when appropriate so local development can use supported developer credentials and Azure-hosted workloads can use managed identity.

Official identity API reference: https://learn.microsoft.com/javascript/api/@azure/identity/

## TypeScript and Node.js defaults

Prefer:

- TypeScript for application code when the project uses it.
- Explicit configuration validation.
- Async/await and proper promise handling.
- Reused Azure SDK clients rather than recreating them per request.
- Structured logging and OpenTelemetry when relevant.
- Managed Identity and service-specific RBAC roles over stored credentials.

## NestJS

Treat NestJS as part of the TypeScript/Node.js guidance, not as a separate Azure language.

For NestJS integrations:

- Register Azure SDK clients through NestJS providers/modules when lifecycle and reuse benefit from DI.
- Keep configuration in dedicated configuration modules/providers.
- Validate required Azure endpoints, resource names, and non-secret settings at startup.
- Keep secrets out of source-controlled configuration.
- Prefer managed identity and `DefaultAzureCredential` for Azure-hosted workloads when supported.
- Avoid creating Azure SDK clients inside controllers or on every request.
- Keep Azure infrastructure concerns separate from domain/application logic.

## Common packages

Depending on the service, common packages include:

- `@azure/identity`
- `@azure/storage-blob`
- `@azure/service-bus`
- `@azure/keyvault-secrets`
- `@azure/app-configuration`

Always verify package names and current usage against official documentation for the specific service.

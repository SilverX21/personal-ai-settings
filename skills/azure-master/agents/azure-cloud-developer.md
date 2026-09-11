# Azure Cloud Developer

Use this role for application development on Azure, application hosting, Azure SDK usage, messaging, configuration, secrets, deployment, and CI/CD across programming languages.

## Language selection

Keep service selection and Azure architecture language agnostic until implementation details matter.

When code is required:

1. Use the user's explicitly requested language/framework.
2. Otherwise use the language established by the current project.
3. Load the matching file under `references/languages/`.
4. If no matching reference exists, keep the Azure reasoning language agnostic and use current official Azure developer documentation for the requested language.

Bundled references cover .NET/C#, JavaScript/TypeScript/Node.js including NestJS, and Python.

## Defaults

- Prefer managed Azure services when they satisfy the requirement.
- Prefer Microsoft Entra ID, managed identity, and supported token-based authentication where appropriate.
- Prefer idiomatic dependency/configuration/client lifecycle patterns for the selected language and framework.
- Prefer Bicep for Azure-native IaC unless the project uses another standard.
- Prefer workload identity federation over long-lived CI/CD secrets where supported.

## Common service choices

- App Service: straightforward web apps/APIs.
- Container Apps: containerized workloads without Kubernetes operations.
- Functions: event-driven/serverless execution when its model fits.
- Service Bus: durable messaging and decoupling.
- Event Grid: event notification/routing.
- Blob Storage: object storage.
- Azure SQL / PostgreSQL: relational workloads.
- Cosmos DB: distributed NoSQL only when its access model and requirements fit.
- Key Vault: secrets/keys/certificates that must be managed as secrets.
- Application Insights / Azure Monitor: application and platform observability.

## Development review checklist

Check:

- Authentication model.
- Authorization / RBAC or service-specific data-plane roles.
- Retry and transient-fault handling.
- Idempotency for message/event processing.
- Configuration and secret handling.
- Observability.
- Timeouts and cancellation/abort behavior appropriate to the language.
- SDK client lifetime / connection management.
- Deployment and rollback.
- Cost-sensitive design choices.

Avoid adding abstractions merely to wrap Azure SDK calls unless they create a genuine boundary.

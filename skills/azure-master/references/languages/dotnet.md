---
last_reviewed: 2026-09-11
---

# .NET / C# on Azure

Use for C#, ASP.NET Core, .NET Worker Services, Azure SDK for .NET, and .NET-specific Azure integration patterns.

## Azure SDK for .NET

Prefer current Azure SDK packages and long-lived/reused SDK clients where the library supports it. Avoid recreating clients per request without a service-specific reason.

Official docs: https://learn.microsoft.com/dotnet/azure/sdk/azure-sdk-for-dotnet

## Authentication

Prefer Microsoft Entra ID and token-based authentication when supported.

`DefaultAzureCredential` is often a good default because local development can use supported developer credentials while Azure-hosted workloads can use managed identity. Explain which credential is expected to succeed in the target environment rather than treating the credential chain as magic.

## Application patterns

Prefer:

- Dependency injection.
- Strongly typed options and configuration.
- Async APIs.
- `CancellationToken` for cancellable operations.
- Structured logging.
- OpenTelemetry / Application Insights integration where relevant.
- Azure SDK client reuse.
- Managed Identity and service-specific RBAC roles over stored credentials.

Avoid unnecessary wrapper abstractions around Azure SDK clients unless they create a genuine domain, testability, or portability boundary.

## Common application types

- ASP.NET Core APIs and web apps.
- .NET Worker Services.
- Azure Functions using supported .NET models.
- Containerized .NET applications on App Service or Azure Container Apps.

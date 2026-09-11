---
last_reviewed: 2026-09-11
---

# Python on Azure

Use for Python applications, Azure SDK for Python, and Python-specific Azure integration patterns.

## Azure SDK for Python

Prefer current Azure SDK client libraries for the service being consumed. Distinguish management-plane libraries from data-plane/client libraries.

Official docs: https://learn.microsoft.com/azure/developer/python/sdk/azure-sdk-overview

## Authentication

Prefer Microsoft Entra ID and token-based authentication when supported.

Use the Azure Identity library and `DefaultAzureCredential` when appropriate so local development can use supported developer credentials and Azure-hosted workloads can use managed identity.

## Python defaults

Prefer:

- Virtual environments and explicit dependency management.
- Async SDK clients when the workload benefits from asynchronous I/O and the target package supports them.
- Reused SDK clients rather than unnecessary recreation.
- Structured logging and OpenTelemetry when relevant.
- Managed Identity and service-specific RBAC roles over stored credentials.
- Clear separation between Azure integration code and domain/application logic.

Do not assume synchronous or asynchronous APIs are interchangeable; follow the specific Azure SDK package model.

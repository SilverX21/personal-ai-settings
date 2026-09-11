---
last_reviewed: 2026-09-11
---

# Terraform + Azure provider boundary

This file covers how Terraform interacts with Azure. It does not replace Azure platform architecture knowledge.

## Source priority

1. HashiCorp Terraform language/core docs.
2. Current Terraform Registry docs for `hashicorp/azurerm` or `Azure/azapi`.
3. Microsoft Azure documentation for Resource Manager/service/identity semantics.

Never guess provider resource arguments or API versions.

## AzureRM vs AzAPI

Use AzureRM for resources/features it supports with a stable typed provider schema.

AzAPI is a thinner layer over Azure Resource Manager REST APIs and complements AzureRM when a resource/feature/API surface is unavailable or not yet represented in AzureRM. Because AzAPI uses ARM API types/versions/body payloads more directly, verify current Azure REST API schema/version and current AzAPI documentation.

Do not choose AzAPI solely because it is “more flexible” if AzureRM already provides a clear supported resource with better Terraform ergonomics.

## Provider configuration

Declare provider sources/versions in `required_providers`. Configure providers at the root/composition level. Current AzureRM provider usage requires its `features {}` block; verify the current Registry docs for subscription and authentication arguments.

## Authentication

Prefer non-interactive identity mechanisms without long-lived secrets:

- Workload identity / OIDC federation.
- Managed Identity.
- Service principal with certificate/secret only when federation/managed identity is not suitable.
- Azure CLI for local development where appropriate.

Current AzureRM/AzAPI Registry docs list Azure CLI, Managed Identity, service-principal certificate/secret, and OpenID Connect methods. Verify exact environment variables/provider arguments before implementation.

## Subscriptions and aliases

A root module can define provider aliases for multiple subscriptions/identities when one composition genuinely spans them. Pass aliases explicitly into child modules that declare `configuration_aliases`.

If subscriptions are operationally independent, separate roots/states can be clearer than a large aliased-provider graph.

## AzureRM backend

The `azurerm` backend stores state in Azure Blob Storage and supports locking/consistency with Azure Blob native capabilities.

Current HashiCorp backend docs recommend Microsoft Entra ID authentication. For automation, OIDC/workload identity federation is the preferred current method where applicable; Managed Identity is also supported.

Avoid SAS tokens/access keys for new workloads when better Entra-based authentication is available, and never hardcode backend credentials.

Use least-privilege data-plane access. Current HashiCorp docs identify `Storage Blob Data Contributor` scoped to the state container as the recommended data-plane role for the Entra ID method. Verify current backend docs before codifying permissions.

The backend is Terraform Core behavior; it is separate from the AzureRM provider resource graph.

## State bootstrap

The storage account/container used for backend state must exist before Terraform can initialize that backend. Keep backend bootstrap deliberately separate (bootstrap stack/manual/platform process) rather than trying to manage the active backend with the same root that depends on it.

## Azure-specific troubleshooting categories

- Wrong subscription/tenant.
- Authentication method/environment mismatch.
- RBAC authorization vs Azure control-plane/data-plane permission mismatch.
- Provider registration/API-version availability.
- AzureRM schema/deprecation change.
- AzAPI ARM payload/API-version issue.
- Resource provider eventual consistency.
- State/address drift.

Use the exact provider error and resource address, then consult the current Registry docs and Microsoft API documentation.

Azure concepts such as Private Endpoint DNS, VNets, AKS internals, Container Apps architecture, or RBAC design belong primarily in Azure platform guidance; this skill covers how Terraform models/configures them.

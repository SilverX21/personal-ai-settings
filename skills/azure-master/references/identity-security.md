---
last_reviewed: 2026-09-11
---

# Azure identity and security

Use for Microsoft Entra ID, Azure RBAC, managed identities, Key Vault, service principals, workload identity, and security reviews.

## Core distinction

- **Authentication** establishes identity.
- **Authorization** determines what that identity can do.

Always identify the caller before changing permissions.

## Managed identities

Managed identities provide Azure resources with identities managed by Microsoft Entra ID so workloads can request tokens without managing application credentials directly.

Prefer least privilege. Choose system-assigned vs user-assigned based on lifecycle, reuse, and operational requirements rather than habit.

Official managed identity guidance: https://learn.microsoft.com/entra/identity/managed-identities-azure-resources/

Best practices: https://learn.microsoft.com/entra/identity/managed-identities-azure-resources/managed-identity-best-practice-recommendations

## Azure RBAC

RBAC assignments combine:

```text
Security principal + Role definition + Scope
```

Scope can be broad or narrow. Prefer the narrowest scope and permissions that satisfy the requirement.

Important: Azure management-plane permissions and service data-plane permissions may use different roles/authorization models. Verify the target service.

Official docs: https://learn.microsoft.com/azure/role-based-access-control/

## Key Vault

Use Key Vault for secrets, keys, and certificates that must be securely stored/managed. Prefer identity-based access from workloads rather than embedding credentials.

Official docs: https://learn.microsoft.com/azure/key-vault/

## Security review defaults

Check:

- Excessive Owner/Contributor grants.
- Long-lived credentials.
- Secrets in source/configuration.
- Public endpoints not required by the workload.
- Missing TLS/encryption controls.
- Missing audit/monitoring.
- Overly broad firewall rules.
- Identity lifecycle and rollback implications.

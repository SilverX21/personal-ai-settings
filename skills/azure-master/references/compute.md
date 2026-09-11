---
last_reviewed: 2026-09-11
---

# Azure compute and application hosting

Use when choosing where workloads run.

## Starting service-selection model

### App Service

Good starting point for conventional web apps and APIs when the team wants managed hosting without managing VMs or Kubernetes.

Consider:

- Runtime support.
- Scaling needs.
- Deployment slots/tier capabilities.
- VNet integration and inbound access requirements.
- OS/container needs.

Official docs: https://learn.microsoft.com/azure/app-service/

### Azure Container Apps

Good for containerized applications, APIs, workers, and event-driven workloads that benefit from managed scaling without operating Kubernetes directly.

Consider:

- Container-based deployment.
- Revisions and scaling model.
- Environment/network topology.
- Dapr only when it solves a real requirement.

Official docs: https://learn.microsoft.com/azure/container-apps/

### Azure Functions

Good for event-driven/serverless workloads when function execution semantics fit the workload.

Consider:

- Trigger/binding model.
- Execution duration and hosting plan.
- Concurrency and scaling.
- Idempotency and retry behavior.
- Cold-start sensitivity where relevant.

Official docs: https://learn.microsoft.com/azure/azure-functions/

### Virtual Machines

Use when OS-level control, legacy software, specialized agents/drivers, or infrastructure requirements justify managing the guest OS.

Official docs: https://learn.microsoft.com/azure/virtual-machines/

### AKS

Use when Kubernetes itself is a requirement or the workload/team genuinely benefits from Kubernetes primitives. Do not choose AKS merely because containers are involved.

Official docs: https://learn.microsoft.com/azure/aks/

## Comparison dimensions

For service choices, compare:

- Operational responsibility.
- Scaling model.
- Deployment model.
- Networking.
- Identity integration.
- Runtime/container requirements.
- Reliability requirements.
- Cost drivers.
- Team capability.

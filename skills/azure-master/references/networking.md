---
last_reviewed: 2026-09-11
---

# Azure networking

Use for VNets, subnets, NSGs, DNS, Private Link, load balancing, connectivity, and network troubleshooting.

## Core mental model

Azure Virtual Network is the core private-network building block for Azure resources. Azure networking services connect resources to each other, on-premises networks, and the internet while providing routing, load balancing, security, and monitoring capabilities.

## Important concepts

- **VNet**: private network boundary/address space.
- **Subnet**: subdivision of a VNet address space.
- **NSG**: stateful network filtering applied to supported NIC/subnet traffic.
- **DNS**: name resolution is frequently part of private connectivity problems.
- **VNet integration**: commonly provides outbound access from supported PaaS services into a VNet; do not confuse it with placing every PaaS resource directly inside the VNet.
- **Private Endpoint**: a network interface with a private IP in a VNet that connects privately to a supported service via Azure Private Link.
- **Service endpoint**: extends VNet identity/private routing semantics to supported Azure services; it is not the same as Private Link.
- **Load Balancer**: Layer 4 load balancing.
- **Application Gateway**: regional Layer 7 web traffic load balancing, commonly with WAF capabilities depending on configuration/SKU.
- **Azure Front Door**: global application delivery / Layer 7 entry point for suitable internet-facing applications.

## Troubleshooting flow

For connectivity failures inspect:

1. Source and destination.
2. DNS result.
3. Expected private/public path.
4. Routes.
5. NSGs/firewalls.
6. Private endpoint configuration.
7. Private DNS zones/links where used.
8. Service-side network settings.
9. Platform/application logs.

Do not assume opening public access proves the correct long-term fix.

## Official sources

- Networking overview: https://learn.microsoft.com/azure/networking/networking-overview
- Networking fundamentals: https://learn.microsoft.com/azure/networking/fundamentals/
- Virtual Network: https://learn.microsoft.com/azure/virtual-network/virtual-networks-overview
- Private Endpoint: https://learn.microsoft.com/azure/private-link/private-endpoint-overview

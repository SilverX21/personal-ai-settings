---
last_reviewed: 2026-09-11
---

# AWS networking

Use for VPC design, connectivity, DNS, edge, load balancing, and troubleshooting.

## VPC

A logically isolated virtual network in AWS.

Core elements:

- CIDR ranges.
- Subnets.
- Route tables.
- Internet Gateway (IGW).
- NAT Gateway where required.
- Security Groups.
- Network ACLs.
- VPC endpoints / PrivateLink.
- Peering / Transit Gateway when justified.

Docs: https://docs.aws.amazon.com/vpc/

## Public vs private subnet

A subnet is typically called **public** when its route table routes internet-bound traffic to an Internet Gateway.

That does **not** automatically make every resource in it publicly reachable. A resource also needs an appropriate public addressing/connectivity model and security controls that allow the traffic.

A private subnet generally lacks a direct route to an Internet Gateway. Outbound internet access often uses a NAT design, while supported AWS service access can use VPC endpoints.

## Security Groups

Stateful virtual firewalls associated with supported resources/network interfaces. Return traffic for allowed connections is automatically permitted by the stateful behavior.

## Network ACLs

Stateless subnet-level controls. Inbound and outbound rules are evaluated separately.

Do not treat NACLs as a replacement for Security Groups.

## Route 53

AWS DNS and domain-routing service. Use for DNS zones, records, routing policies, and health-check-related routing patterns when applicable.

Docs: https://docs.aws.amazon.com/route53/

## Load balancing

Elastic Load Balancing includes multiple load balancer types.

For application-level HTTP/HTTPS routing, Application Load Balancer is a common fit. Network Load Balancer serves lower-level/high-performance TCP/UDP/TLS use cases.

Always verify current feature differences before making a precise selection.

Docs: https://docs.aws.amazon.com/elasticloadbalancing/

## CloudFront

Global content delivery network that can cache and accelerate content and applications at edge locations.

Docs: https://docs.aws.amazon.com/cloudfront/

## VPC endpoints / PrivateLink

Provide private connectivity to supported AWS services or endpoint services without requiring traffic to traverse the public internet.

Docs: https://docs.aws.amazon.com/vpc/latest/privatelink/what-is-privatelink.html

## Connectivity troubleshooting

Trace the full path:

1. Source identity/workload.
2. DNS resolution.
3. Source subnet and route table.
4. IGW/NAT/VPC endpoint/peering/TGW as applicable.
5. Security Group egress/ingress.
6. NACL outbound/inbound.
7. Target listener/service configuration.
8. Target authorization.

Avoid solving unknown network problems by opening `0.0.0.0/0` broadly.

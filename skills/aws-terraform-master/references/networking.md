# AWS networking

**Read this before allocating any CIDR.** IP addressing is the one decision that cannot be
fixed later without renumbering. A VPC's primary CIDR can never be removed — only added to.

## CIDR planning

**Use `10.0.0.0/8`.** It is AWS's recommended range and gives you 16 million addresses to
plan within. Avoid `192.168.0.0/16` for anything production — it collides with home
networks and VPN client pools, which surfaces the day someone works from home.
`172.16.0.0/12` is the acceptable second choice.

**Allocate contiguously and hierarchically**, so routes summarize:

```
10.0.0.0/8       organization
├── 10.0.0.0/12  eu-west-1
│   ├── 10.0.0.0/16   prod-platform
│   ├── 10.1.0.0/16   prod-data
│   └── 10.2.0.0/16   staging
├── 10.16.0.0/12 us-east-1
└── 10.128.0.0/9 reserved for on-premises
```

**Reserve 50% of the space for growth.** Regions, business units, and acquisitions arrive
without warning, and the cost of reserving unused address space is zero.

**Document on-premises ranges before allocating anything in AWS.** Branch offices and VPN
pools included. A common split gives AWS `10.0.0.0/9` and on-premises `10.128.0.0/9` — 8
million addresses each, and overlap becomes structurally impossible.

**Never overlap CIDRs between VPCs you might ever connect.** Overlapping VPCs cannot peer,
cannot share a Transit Gateway route table, and cannot reach each other over Direct
Connect. There is no network-layer workaround. This is the mistake that forces migrations.

**Use AWS IPAM** for anything beyond a handful of VPCs. It enforces hierarchical
allocation, prevents overlap across accounts, and replaces the spreadsheet that will
otherwise become the source of truth and then become wrong.

## Sizing

| Scope | Size | Notes |
|---|---|---|
| Production VPC | `/16` | 65,536 addresses; 256 possible `/24` subnets |
| Non-production VPC | `/20` | 4,096 addresses |
| Single-purpose VPC | `/24` or `/28` | Inspection, endpoints-only |
| Standard workload subnet | `/24` | **251 usable** — AWS reserves 5 per subnet |
| Infrastructure subnet | `/28` | TGW attachments, NAT, Network Firewall endpoints |

AWS reserves five addresses in every subnet: network address, VPC router (`.1`), DNS
(`.2`), one reserved (`.3`), and broadcast. A `/24` gives 251 usable, not 256. Sizing
calculations that assume 256 fail at exactly the wrong moment.

**Do not allocate `/24` VPCs "to save space."** You are not saving anything — private
address space is free — and you exhaust subnet capacity almost immediately.

**Leave numbering gaps** between subnet tiers (`.0`, `.10`, `.20`, `.30`) so a new tier can
be inserted without renumbering.

## Subnet architecture

**Three Availability Zones.** Two is the minimum for availability; three is required by
some services (MSK, Aurora with two readers) and gives meaningfully better failure
tolerance. Keep the tier layout identical in every AZ.

Standard tiers:

- **Public** — ALB/NLB, NAT gateways. Nothing else. No application ever lives here.
- **Private** — application compute. Egress via NAT.
- **Isolated** — databases. No route to a NAT gateway or internet gateway at all.

For EKS, use **`100.64.0.0/10` as a secondary VPC CIDR for pod networking**. Pods consume
addresses at a rate that will exhaust a normally-sized primary CIDR, and this keeps node and
infrastructure addressing clean.

## NAT gateways

**One NAT gateway per AZ**, with each AZ's private subnets routing through their local one.
A single shared NAT gateway is both a single point of failure and a cross-AZ data transfer
charge on every packet.

NAT gateways are expensive in a way that is easy to miss: roughly **$0.045/GB of data
processed**, applied to *all* traffic including traffic to AWS services in the same region.
This is one of the largest silent line items in a typical AWS bill.

In non-production, a single NAT gateway (or none, using VPC endpoints only) is a reasonable
trade.

## VPC endpoints

**Gateway endpoints for S3 and DynamoDB are free.** Create them in every VPC, always. They
remove NAT data-processing charges for that traffic entirely and keep it off the public
path. There is no argument against them.

**Interface endpoints** (PrivateLink) cost per hour per AZ plus per GB, but are usually
cheaper than routing the same traffic through NAT — and they are required for private
subnets with no NAT at all. Common ones worth having: ECR (api and dkr), Secrets Manager,
SSM, CloudWatch Logs, STS.

## Connecting VPCs

- **VPC peering** — two VPCs, non-transitive. Fine for a handful; the mesh becomes
  unmanageable past roughly five.
- **Transit Gateway** — hub-and-spoke, transitive, route tables for segmentation. The
  default for multi-VPC and hybrid at any real scale. Charges per attachment and per GB.
- **PrivateLink** — expose a single service across accounts without joining networks. The
  right answer when one team consumes another team's API and nothing more.
- **Cloud WAN** — global, policy-driven, multi-region. Consider it when Transit Gateway
  peering across regions becomes the thing you maintain.

**Centralize egress** through a shared services VPC once you have more than a few VPCs
needing internet access — one set of NAT gateways and one inspection point beats N.

## Security groups vs NACLs

Security groups are stateful, attach to ENIs, and are the primary control — use them.
NACLs are stateless, attach to subnets, and are a coarse secondary control. **Do not use
NACLs for application-level rules.** Stateless rules require matching ephemeral-port return
traffic, and getting that wrong produces failures that look like anything but a NACL.

Reference security groups by ID rather than CIDR wherever possible
(`referenced_security_group_id`) — the rule then describes intent ("the API may reach the
database") rather than an address range that will change.

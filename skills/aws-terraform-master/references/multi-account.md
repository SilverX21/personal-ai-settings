# Multi-account architecture

The account is AWS's strongest isolation boundary — stronger than a VPC, stronger than IAM.
Blast radius, billing separation, and quota isolation all follow account lines.

## Why multiple accounts

- **Blast radius.** A compromised or misconfigured workload is bounded by its account.
- **Quotas.** Service limits are per-account. One noisy workload cannot exhaust another's.
- **Billing.** Per-account cost attribution needs no tagging discipline to be correct.
- **Access control.** "Nobody has production access" is enforceable at the account
  boundary in a way it never is inside one account.

The threshold is low. Two workloads with different blast-radius requirements is already
enough. Separate production from everything else on day one.

## Standard account structure

```
Root
├── Management account          # Organizations only. No workloads. No exceptions.
├── Security OU
│   ├── Log Archive             # Centralized CloudTrail, Config, VPC flow logs
│   └── Audit / Security Tooling # Security Hub, GuardDuty, Config aggregator
├── Infrastructure OU
│   ├── Network                 # Transit Gateway, centralized egress, DNS
│   └── Shared Services         # CI/CD, artifact registries, tooling
├── Workloads OU
│   ├── Prod OU
│   └── Non-Prod OU
├── Sandbox OU                  # Time-boxed, budget-capped, no data
└── Suspended OU                # Deny-all SCP; holding pen for decommissioning
```

**The management account runs nothing.** No workloads, no IAM users, no CI roles. It is the
account that can dissolve the organization; treat it accordingly. Delegate every security
service to the Audit account as **delegated administrator** so day-to-day operations never
need management-account access.

**Control Tower** gets you this structure with guardrails in a managed way. Building it
directly on Organizations gives more control at the cost of owning the guardrails yourself.
Either is defensible; the deciding question is whether you have the team to maintain a
hand-rolled landing zone.

## Service Control Policies

SCPs set the **maximum** permissions available in an account. They grant nothing — they only
constrain. An action needs both an SCP allowing it and an IAM policy granting it.

Hard constraints to know before writing any:

- **Maximum 5 SCPs** attached to any single root, OU, or account.
- **5,120 characters per SCP**, strictly enforced. Large policies must be split, which
  interacts badly with the limit of 5.
- **SCPs do not apply to the management account.** This is the reason nothing runs there.
- SCPs apply to roles *and* the root user in member accounts.

**Always test in a sandbox OU first.** A single character error can lock every principal
out of an account, including the ones you would use to fix it. This is the most common
self-inflicted AWS outage.

Baseline SCPs worth having:

| Policy | Purpose |
|---|---|
| Deny disabling CloudTrail, Config, GuardDuty, Security Hub | Protects detection; the first thing an attacker turns off |
| Deny leaving the organization | Prevents account exfiltration |
| Deny root user actions | Root should never be used operationally |
| Region deny-list | Reduces attack surface and unexpected spend |
| Deny creation of untagged resources | Makes tagging actually enforceable |
| Deny public S3 / public AMI sharing | Blocks the classic data exposure paths |

Attach broad protective policies at the root or OU level. Narrow, workload-specific
policies at the account level. Reserve at least one slot for future needs.

## Security baseline

Every account, enabled automatically at creation:

- **CloudTrail** — organization trail, all regions, logging to the Log Archive account,
  with log file validation enabled.
- **AWS Config** — recording all supported resources, aggregated into the Audit account.
- **GuardDuty** — organization-wide, delegated to Audit.
- **Security Hub** — organization-wide, delegated to Audit, with the AWS Foundational
  Security Best Practices standard enabled.
- **IAM Access Analyzer** — organization-level, to find resources shared externally.
- **S3 Block Public Access** — at the account level, not per bucket.
- **EBS encryption by default.**
- Default VPCs deleted in every region you do not use.

Centralize logs in the Log Archive account with **write-only, immutable retention** — Object
Lock in compliance mode. Logs an attacker can delete are not evidence.

## Identity

**IAM Identity Center** (successor to AWS SSO) for all human access, federated to your
existing identity provider. Permission sets map groups to accounts. Nobody gets IAM users;
nobody gets long-lived keys.

> **Terraform limitation:** IAM Identity Center cannot be *enabled* through Terraform. Turn
> it on in the console once, then manage permission sets and assignments as code.

**Machine access** uses roles assumed via OIDC (GitHub Actions) or instance/task roles.

**Cross-account access** is one role per purpose with a scoped trust policy. Never a shared
"admin" role with a wildcard principal.

## Terraform against many accounts

Use **aliased providers with `assume_role`** — this is the case where aliases remain
correct even on provider v6 (the `region` argument solves multi-region, not multi-account):

```hcl
provider "aws" {
  alias  = "network"
  region = var.region
  assume_role {
    role_arn = "arn:aws:iam::${var.network_account_id}:role/terraform-execution"
  }
}

module "transit_gateway" {
  source    = "./modules/tgw"
  providers = { aws = aws.network }
}
```

Give each account its own state, or at minimum its own state key with its own IAM policy.
A single state spanning production and sandbox recreates in software the blast radius you
separated accounts to avoid.

Bootstrap ordering matters: the organization and accounts are created by one root module,
the per-account baseline by another, workloads by a third. Do not attempt one apply that
creates an account and provisions inside it — the credentials do not exist yet at plan time.

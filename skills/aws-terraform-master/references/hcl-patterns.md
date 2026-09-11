# HCL patterns

Copy-paste shapes for the rules in `SKILL.md`. Load this when writing or reviewing
resources, backends, providers, secrets, IAM trust, or tags. Do not load it for a naming
or module-boundary question.

## Repository layout

Root module:

```
.
├── backend.tf
├── data.tf
├── envs
│   ├── dev/terraform.tfvars
│   ├── staging/terraform.tfvars
│   └── prod/terraform.tfvars
├── locals.tf
├── main.tf
├── outputs.tf
├── providers.tf
├── README.md
├── variables.tf
└── versions.tf
```

Reusable module — `required_providers` only, never a `provider` block:

```
.
├── examples
│   ├── complete/
│   └── minimal/
├── main.tf
├── outputs.tf
├── README.md          # generated inputs/outputs via terraform-docs
├── variables.tf
└── versions.tf
```

## Module `versions.tf`

Shared modules constrain loosely (`>=`); root modules pin narrowly (`~>`).

```hcl
# modules/service/versions.tf — correct
terraform {
  required_version = ">= 1.11"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.0"
    }
  }
}
```

## Pinning a community module

Commit hash, version in a trailing comment. Tags are mutable.

```hcl
module "vpc" {
  source = "github.com/terraform-aws-modules/terraform-aws-vpc.git?ref=8bbc07e" # v5.13.0
}
```

A registry `version = "5.13.0"` pin is acceptable where the organization already trusts
the registry; a floating `~>` on a third-party module is not.

## Variable validation

```hcl
variable "environment" {
  type        = string
  description = "Deployment environment."
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}
```

## Attachment resources, not inline blocks

Inline `ingress`/`egress`, `inline_policy`, and `route` blocks produce confusing diffs and
fight with anything else managing the same relationship. Same pattern for
`aws_iam_role_policy_attachment` and `aws_route`.

```hcl
resource "aws_security_group" "this" {
  name   = "svc-api"
  vpc_id = var.vpc_id
}

resource "aws_vpc_security_group_ingress_rule" "https" {
  security_group_id = aws_security_group.this.id
  description       = "TLS from VPC"
  cidr_ipv4         = var.vpc_cidr
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}
```

## `moved` blocks

Refactoring is code. Never `terraform state mv`.

```hcl
moved {
  from = aws_instance.web
  to   = module.web.aws_instance.this
}
```

## S3 backend

```hcl
terraform {
  backend "s3" {
    bucket       = "acme-tfstate-prod"
    key          = "platform/network/terraform.tfstate"
    region       = "eu-west-1"
    encrypt      = true
    use_lockfile = true
  }
}
```

## Root module pins

```hcl
terraform {
  required_version = "~> 1.14"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.30"
    }
  }
}
```

Multi-region on provider v6+ uses the resource `region` argument, not an aliased provider.
Aliased providers remain correct for **multi-account** (different `assume_role`).

```hcl
resource "aws_s3_bucket" "replica" {
  bucket = "acme-assets-replica"
  region = "us-east-1"
}
```

## Write-only secrets

Terraform 1.11+ / provider v6+. The value never enters plan or state.

```hcl
ephemeral "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id
}

resource "aws_db_instance" "this" {
  # ...
  password_wo         = ephemeral.aws_secretsmanager_secret_version.db.secret_string
  password_wo_version = var.db_password_version   # bump to trigger a rotation
}
```

## GitHub OIDC in CI

No stored AWS credentials. Scope the trust policy to the specific repository **and ref**.

```yaml
permissions:
  id-token: write        # required for OIDC
  contents: read
  pull-requests: write   # to comment the plan

steps:
  - uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: arn:aws:iam::111122223333:role/gha-terraform-plan
      aws-region: eu-west-1
```

## Provider `default_tags`

Root module only. Resource-level `tags` merge with defaults and win on conflict — use them
only for what is genuinely per-resource, typically `Name`.

```hcl
provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Environment = var.environment
      Project     = var.project
      Owner       = var.owning_team
      CostCenter  = var.cost_center
      ManagedBy   = "terraform"
      Repository  = var.repository_url
    }
  }
}
```

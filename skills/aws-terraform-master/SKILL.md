---
name: aws-terraform-master
description: >
  AWS cloud architecture, Terraform engineering standards, and live AWS debugging. Load
  for any Terraform or AWS infrastructure task — writing or reviewing HCL, module design,
  state and backends, provider versions, IAM and secrets, CI/CD for infrastructure, drift,
  cost, networking, multi-account design, or choosing between AWS services. Also load when
  something deployed is broken: a stopped or failing ECS task, a Lambda erroring or timing
  out, failing health checks, ALB 5xx, CloudWatch log investigation, connectivity failures,
  AccessDenied, or an unexplained latency or cost change. Triggers on Terraform, HCL,
  OpenTofu, terraform plan/apply, AWS, VPC, IAM, EKS, ECS, Fargate, Lambda, RDS, S3,
  CloudFront, CloudWatch, CloudTrail, AWS Organizations, Well-Architected, and on
  infrastructure files (*.tf, *.tfvars, *.tftest.hcl, *.tftpl, .terraform.lock.hcl,
  terragrunt.hcl). Not a general-purpose DevOps skill — do not load it for CI/CD work that
  has no AWS or Terraform component.
---

# AWS Terraform Master

Engineering standards for AWS infrastructure built with Terraform.

## Scope

**In scope.** Terraform and the HCL language, the AWS provider, module design, state and
backends, infrastructure CI/CD, and AWS architecture decisions — networking, identity,
compute and data service selection, multi-account structure, cost, resilience, and
observability. The files that configure them: `*.tf`, `*.tfvars`, `*.tftest.hcl`,
`*.tftpl`, `.terraform.lock.hcl`, `.tflint.hcl`, and the workflow files that run them.

**Out of scope.** An infrastructure repository legitimately contains application code,
Dockerfiles, Helm charts, SQL, and shell scripts. Read them when you need to understand
what the infrastructure serves — **never analyze, reformat, or "fix" them under these
standards.** They have their own. Kubernetes manifests and Helm values are not Terraform
even when a Terraform module applies them.

**Modification boundary.** Change a file only when the task requires it. Identify the root
module first, then the files that matter. Never edit a file merely because it turned up in
a search, and never touch `.terraform/`, `terraform.tfstate`, `terraform.tfstate.backup`,
or `crash.log`.

**Never run `terraform apply`, `destroy`, `state rm`, `state mv`, `taint`, or `import`
without explicit approval for that specific command.** `plan`, `validate`, `fmt`, `init`,
and `providers lock` are safe to run unprompted. `apply` is an outward-facing action
against live infrastructure and money.

---

## Version awareness — read this before recommending anything

These standards describe **Terraform 1.14** and **AWS provider v6**. Projects on older
versions are normal and not defects.

1. **Check the versions before advising.** Read `required_version` and `required_providers`
   from `versions.tf` (or `terraform.tf`), and the resolved versions in
   `.terraform.lock.hcl`. The lock file is the truth about what actually runs.
2. **Never recommend a feature the pinned version doesn't have.** The features below are
   recent enough that most repositories you meet will not have them:

   | Feature | Needs | What it replaces |
   |---|---|---|
   | Native test framework (`.tftest.hcl`) | Terraform 1.6+ | Terratest for config-level assertions |
   | `import` blocks (declarative) | Terraform 1.5+ | `terraform import` CLI calls |
   | `check` blocks | Terraform 1.5+ | Post-apply assertions in scripts |
   | Ephemeral resources / `ephemeral` values | Terraform 1.10+ | Secrets landing in state |
   | S3 **native** state locking (`use_lockfile`) | Terraform 1.10+ | **DynamoDB lock table (deprecated)** |
   | Write-only arguments (`*_wo`) | Terraform 1.11+ | Passwords stored in state |
   | `region` argument on individual resources | AWS provider v6+ | Aliased providers for multi-region |
   | Actions blocks, list resources, `terraform query` | Terraform 1.14+ | Bulk discovery/import scripting |

3. **The DynamoDB lock table is legacy.** Since Terraform 1.10 the S3 backend locks
   natively with `use_lockfile = true`. AWS states DynamoDB-based locking is deprecated and
   will be removed. New backends must not create a lock table. Existing ones can run both
   during migration.
4. **AWS provider v5 → v6 is a breaking upgrade.** v6 adds `region` to nearly every
   non-global resource, which removes most reasons to declare aliased providers. It also
   made previously-optional attributes required on several resources and deprecated the
   global S3 endpoint. Consult the official upgrade guide — do not upgrade from memory.
5. **Name the version whenever guidance is version-sensitive** ("provider v6+", "Terraform
   1.11+"), so the reader knows whether it applies to them.
6. **Prefer official HashiCorp and AWS documentation** over blog posts or memory for
   version-sensitive behavior. Provider resource schemas change every release.

---

## Core principles

- **The plan is the review artifact.** Nothing reaches an environment that a human has not
  seen planned. If you cannot show what will change, you are not ready to change it.
- **Least privilege, everywhere, always.** Applied to IAM roles, to state bucket access, to
  who can run apply, and to what CI is allowed to touch.
- **Blast radius is a design parameter.** Choose state boundaries, account boundaries, and
  module boundaries so that a mistake is contained. This is the single most consequential
  structural decision in an infrastructure codebase.
- **Everything is versioned and pinned.** Providers, modules, and the Terraform binary. An
  unpinned dependency is an unreviewed change waiting to arrive on a Tuesday.
- **The code is the source of truth.** Out-of-band changes are incidents, not shortcuts.
  Drift is detected and reconciled deliberately, never silently.
- **YAGNI.** No module for one resource, no variable for a value that never varies, no
  environment abstraction for an environment that does not exist yet.
- **Boring over clever.** HCL is a configuration language with a weak type system read
  under pressure at 3am. Nested `for` expressions over dynamic blocks generating
  conditional resources is a debugging trap, not a technique.

### Avoid over-engineering

Do not create a module that wraps a single resource, a variable for a value with exactly
one possible setting, a `locals` indirection that renames something once, an environment
folder for an environment that does not exist, or a wrapper around a community module that
only forwards arguments. Each abstraction must earn its place by removing real duplication
or encoding a real decision.

---

## Stack defaults

Sensible defaults, **not requirements** — a project's existing choices win.

| Concern | Default | Note |
|---|---|---|
| Binary | Terraform (HashiCorp) | OpenTofu is a valid fork; syntax is compatible today |
| State backend | S3 + `use_lockfile = true` | Versioning + SSE + AWS Backup on the bucket |
| Environment separation | Separate backend per environment, ideally separate AWS account | Not workspaces |
| Auth from CI | GitHub OIDC → `sts:AssumeRole` | Never long-lived access keys |
| Auth locally | `assume_role` in provider config or a named profile | Never static keys on disk |
| Runner | GitHub Actions: plan on PR, apply on merge | Branch protection required |
| Format / lint | `terraform fmt`, `terraform validate`, TFLint (+ AWS ruleset) | Pre-commit and CI |
| Security scan | Checkov (+ Trivy) | Trivy is the successor to tfsec |
| Cost | Infracost on PRs | Diff, not absolute |
| Docs | terraform-docs, generated into `README.md` | Enforced in CI |
| Tests | Native `.tftest.hcl`; Terratest only for real-world assertions | See Testing |
| Secrets | AWS Secrets Manager / SSM + write-only arguments | Never in `.tf` or `.tfvars` |
| Tagging | Provider `default_tags` in the root module | Plus Organizations tag policies |

---

## Repository and file structure

Standard file names, always — the ecosystem's tooling assumes them.

| File | Contents |
|---|---|
| `main.tf` | Resources, data sources, and **all** nested module calls |
| `variables.tf` | Input variable declarations |
| `outputs.tf` | Output declarations |
| `locals.tf` | Local values |
| `providers.tf` | `provider` blocks — **root modules only** |
| `versions.tf` | `terraform` block: `required_version`, `required_providers` |
| `backend.tf` | Backend configuration (root modules only) |
| `data.tf` | Data sources, *only* once they outgrow living beside their consumer |

Directories: `modules/` for nested modules, `examples/` for usage examples, `scripts/` for
scripts Terraform invokes, `helpers/` for scripts it does not, `files/` for static files
read with `file()`, `templates/` for `.tftpl` files read with `templatefile()`.

**Do not split resources into service-named files** (`iam.tf`, `rds.tf`, `s3.tf`) by
reflex. Resources belong in `main.tf`. Split only when one coherent group exceeds roughly
150 lines — then `iam.tf` is reasonable.

### Root module layout

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

### Reusable module layout

```
.
├── examples
│   ├── complete/
│   └── minimal/
├── main.tf
├── outputs.tf
├── README.md          # generated inputs/outputs via terraform-docs
├── variables.tf
└── versions.tf        # required_providers ONLY, never a provider block
```

Follow registry conventions even when you have no plan to publish: repository named
`terraform-aws-<name>`, semver git tags (`v1.4.0`). It costs nothing now and makes
publishing later a non-event.

---

## Module design

**A module is a logical component, not an environment.** A VPC, a service, a data tier —
never "prod".

**Do not wrap single resources.** If you cannot name the module something meaningfully
different from the resource type inside it, it is not an abstraction — it is a layer of
indirection between the reader and the truth. Use the resource directly.

**Keep the tree flat.** One or two levels of nesting, maximum. Modules should build *on*
other modules, not tunnel *through* them. A module three levels down whose variables are
forwarded by two intermediate modules is unreadable and undebuggable.

**Never declare `provider` blocks inside a module.** Modules inherit providers from their
caller. A module that configures its own provider cannot be used twice, cannot be used in
another region, and breaks `terraform destroy`. Declare `required_providers` in the
module's `versions.tf`; declare `provider` blocks only in the root module.

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

Use `>=` in shared modules (consumers need room to resolve a common version) and `~>` in
root modules (you control the upgrade).

**Every resource gets at least one output referencing it.** Without outputs, callers cannot
express dependencies on what your module built, and Terraform cannot order them correctly.

**Group by lifecycle, not by service.** A module should encapsulate resources that are
created, changed, and destroyed together.

### Community modules vs your own

Use a **community module** when the resource has high edge-case density and contains no
opinion of yours: VPC, EKS, RDS, ALB, CloudFront. Reproducing `terraform-aws-eks`
correctly is months of edge cases you will get wrong.

Write **your own module** when it encodes a decision your organization made: IAM permission
boundaries, account baselines, service scaffolds, anything security-sensitive. You must be
able to read it during an incident.

Rules for consuming community modules:

- **Pin to a commit hash**, with the version in a trailing comment. Tags are mutable;
  public registries are a supply-chain surface.

  ```hcl
  module "vpc" {
    source = "github.com/terraform-aws-modules/terraform-aws-vpc.git?ref=8bbc07e" # v5.13.0
  }
  ```

  A registry `version = "5.13.0"` pin is acceptable where your organization already trusts
  the registry; a floating `~>` on a third-party module is not.
- **Customize through variables. Never fork.** Fork only to contribute the fix upstream.
- **Read the dependency tree before adopting**: required providers, nested modules,
  external data sources. Cascading dependencies are how a module surprises you.
- **Watch the repository** for releases rather than discovering upgrades during an incident.
- Prefer verified publishers with recent commits and real issue traffic.

---

## Variables and outputs

- **Every variable has a `type` and a `description`.** The description is documentation —
  terraform-docs publishes it.
- **Required variables omit `default`.** Add `nullable = false` when null is meaningless.
- **Environment-independent values get defaults** (`instance_count`, `log_retention_days`).
  **Environment-specific values do not** (`vpc_id`, `account_id`) — force the caller to be
  explicit.
- **Be stingy with variables.** Adding one later is backward compatible; removing one is
  not. If you cannot name a concrete case where a value must differ, use a `local`.
- **Validate at the boundary.** Use `validation` blocks for anything with a real constraint
  — this is input validation, and it is never "over-engineering".

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

- **Never pass a resource attribute through an input variable to fake a dependency.**
  Reference the attribute directly so Terraform builds the implicit dependency edge.
- Mark sensitive outputs `sensitive = true`. This suppresses CLI display; it does **not**
  keep the value out of state — see Secrets.

---

## Naming conventions

- `snake_case` for all resource, variable, output, and local names.
- Name the sole resource of its type `this`. Use `main` only where the codebase already
  does.
- **Never repeat the resource type in the name.** `aws_s3_bucket.logs`, not
  `aws_s3_bucket.logs_bucket`.
- Singular, not plural, even with `for_each`.
- Meaningful distinctions: `primary` / `read_replica`, not `db1` / `db2`.
- **Units in names of numeric values**: `ram_size_gb`, `timeout_seconds`,
  `retention_days`. Binary units (MiB/GiB) for storage, decimal (MB/GB) elsewhere.
- **Positive booleans**: `enable_deletion_protection`, never `disable_*` — double negatives
  in conditionals cause outages.

---

## Resource authoring

**Prefer attachment resources over inline blocks.** Inline pseudo-resources produce
confusing diffs and fight with anything else managing the same relationship.

```hcl
# Avoid — inline rules
resource "aws_security_group" "this" {
  ingress { ... }
  egress  { ... }
}

# Prefer — separate rule resources (provider v5+)
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

The same applies to `aws_iam_role_policy_attachment` over inline `inline_policy`, and
`aws_route` over inline `route` blocks.

**Use `for_each`, not `count`, for sets of non-identical things.** `count` indexes by
position, so removing the second of three items destroys and recreates the third.
`for_each` keys by a stable identifier. Reserve `count` for genuine on/off toggles.

**Use `moved` blocks when refactoring**, never `terraform state mv`. Refactoring is code;
it belongs in the diff and in review.

```hcl
moved {
  from = aws_instance.web
  to   = module.web.aws_instance.this
}
```

**Use `import` blocks (1.5+)** rather than the `terraform import` CLI, for the same reason:
the plan shows the import, and the reviewer sees it.

**Build IAM policies with `aws_iam_policy_document`**, not heredoc JSON. You get validation,
interpolation, and readable diffs.

**Avoid `lifecycle { ignore_changes }` as a default reflex.** It hides drift permanently.
When it is genuinely needed (a tag written by an external controller), scope it to the
specific attribute and comment why.

**Never use `provisioner` blocks or `null_resource`/`terraform_data` with `local-exec`** to
do work a resource or a data source can do. Terraform does not track what a script did, so
that work is invisible to plan, state, and destroy.

---

## State and backends

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

The state bucket itself must have: **versioning enabled** (this is your rollback),
server-side encryption, public access fully blocked, an AWS Backup plan, and a restrictive
bucket policy.

### Separate backends per environment

Distinct buckets (or at minimum distinct keys with distinct IAM policies) per environment,
ideally in **separate AWS accounts**. Not workspaces — workspaces share a backend, so an
accident can still cross an environment boundary. Reserve workspaces for ephemeral,
low-stakes iterations inside a single dev account.

Production state should be **read-only for humans**. Write access belongs to the CI role
and a break-glass role, and nothing else.

### Split state by blast radius

One state per layer, split where the **change cadence** differs:

| Layer | Contents | Changes |
|---|---|---|
| Foundation | Accounts, OUs, SCPs, IAM baseline | Rarely |
| Network | VPC, subnets, TGW, endpoints, DNS | Rarely |
| Platform | EKS/ECS cluster, shared ALB, CI roles | Occasionally |
| Data | RDS, ElastiCache, S3 data buckets | Occasionally |
| Application | Services, task definitions, functions | Daily |

Networking changes once a quarter; applications change hourly. Putting them in one state
means every app deploy plans the whole VPC and every app mistake can reach it.

Share values between layers via **`terraform_remote_state` data sources or SSM
Parameter Store**. Prefer SSM when the consumer is in another account or another team's
pipeline — it does not require read access to the producer's state file.

### Auditing state

Enable CloudTrail data events on the state bucket, filtered for `PutObject` and
`DeleteObject`, so every state change is attributable to a principal. Combined with
versioning this gives you "who changed what, when, and what it looked like before."

**Alert on state unlocks originating outside CI.** A lock released from a developer
workstation means someone applied by hand, and that is the highest-signal warning your
infrastructure pipeline produces.

---

## Providers and versions

**Root modules pin narrowly. Shared modules constrain loosely.**

```hcl
# Root module
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

- **Commit `.terraform.lock.hcl`.** It is the reproducibility guarantee. Regenerate for all
  platforms your team and CI use:
  `terraform providers lock -platform=darwin_arm64 -platform=linux_amd64`
- **Fail CI on unpinned providers.** TFLint's `terraform_required_providers` rule does
  this. An implicit major upgrade reaching production is an entirely preventable outage.
- **Upgrade minors in non-production first**, read the changelog, then promote.
- **Multi-region on provider v6+ uses the `region` argument**, not aliased providers:

  ```hcl
  resource "aws_s3_bucket" "replica" {
    bucket = "acme-assets-replica"
    region = "us-east-1"
  }
  ```

  Aliased providers remain correct for **multi-account** (different `assume_role`) and for
  provider-level configuration that genuinely differs. Global services — IAM, CloudFront,
  Route 53, Organizations — have no `region`.

---

## Secrets and sensitive data

**The default assumption: anything Terraform manages ends up in state in plaintext.**
`sensitive = true` only hides values from CLI output. State is the leak.

Order of preference:

1. **Do not let Terraform hold the secret at all.** Create the Secrets Manager secret
   *container* in Terraform; populate the value out of band. The application reads it at
   runtime.
2. **Write-only arguments (Terraform 1.11+ / provider v6+)** for values a resource must
   receive at create/update time. `*_wo` arguments never enter plan or state.

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

3. **Ephemeral resources / `ephemeral` variables (1.10+)** for anything needed only during
   the run — short-lived tokens, generated passwords. Never persisted.
4. **`sensitive = true`** as a last resort for values that must live in state anyway. It
   reduces accidental disclosure in logs; it does not protect the state file.

**Never** commit secrets to `.tf` or `.tfvars`, pass them as plaintext CI variables when
OIDC can avoid it, or `output` a secret without `sensitive = true`. Add `*.tfvars` (except
committed non-sensitive env files) and `*.tfstate*` to `.gitignore`.

---

## Authentication and IAM

**Never use long-lived access keys.** Not locally, not in CI.

**In CI — GitHub OIDC.** No stored AWS credentials at all:

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

Scope the trust policy to the specific repository **and ref** — a trust policy matching
`repo:acme/*` lets any repository in the org assume your production role.

**Locally — assume a role**, via `assume_role` in the provider block or an AWS CLI profile
with `role_arn`. Both yield temporary credentials.

**On EC2 / ECS / Lambda** — instance profiles and task roles. Never a key on disk.

**Separate plan from apply.** The plan role is read-only (`ReadOnlyAccess` plus state read).
The apply role can write and is assumable only from the protected branch. This single split
prevents a PR from a fork mutating production.

**Write least-privilege policies.** Start empty, add what fails, never `Action: "*"`. Use
IAM Access Analyzer's policy generation from CloudTrail to derive real usage, then prune.
Re-run it periodically — permissions accrete.

**Different roles per environment.** Never one `terraform-admin` role across dev and prod.

---

## Tagging

Apply organization-wide tags through provider `default_tags` in the **root module** —
never repeat them on every resource:

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

- Resource-level `tags` merge with defaults and win on conflict. Use them only for what is
  genuinely per-resource, typically `Name`.
- **Start with 5–7 mandatory tags and enforce them** before adding more. An unenforced tag
  is worse than no tag — it produces cost reports that are confidently wrong.
- **Pick a capitalization convention once** (`CostCenter`, not `costcenter`/`Costcenter`)
  and never deviate. Tag keys are case-sensitive and split your cost reporting silently.
- Enforce with **AWS Organizations tag policies**, and SCPs denying creation of untagged
  resources, so the console path cannot bypass what Terraform enforces.
- A handful of resources cap tag counts (S3 object copies allow 10) — use
  `override_provider` there rather than dropping defaults globally.

---

## Testing

**Native tests (`.tftest.hcl`, Terraform 1.6+) are the default.** Same language, no Go
toolchain, runs in CI without cloud credentials when you stay at plan level.

```hcl
# tests/defaults.tftest.hcl
variables {
  environment = "dev"
  vpc_cidr    = "10.0.0.0/16"
}

run "encryption_is_enforced" {
  command = plan          # no infrastructure created

  assert {
    condition     = aws_s3_bucket_server_side_encryption_configuration.this.rule[0].apply_server_side_encryption_by_default[0].sse_algorithm == "aws:kms"
    error_message = "Bucket must use KMS encryption."
  }
}

run "rejects_invalid_environment" {
  command = plan
  variables { environment = "production" }   # not in the allowed list

  expect_failures = [var.environment]
}
```

- `command = plan` — unit test. Fast, free, no credentials. **This is where most of your
  tests belong**: variable validation, conditional logic, computed names, policy documents.
- `command = apply` — integration test. Real resources, real cost, real teardown. Reserve
  for modules whose value is in how AWS actually behaves.

**Know what a native test proves.** It asserts against what the *provider reported*, not
against reality. A test can pass while the deployed thing does not work. When you need to
assert that the endpoint actually serves traffic or the IAM policy actually denies the
call, that is **Terratest** (Go) or a post-apply smoke test — not the native framework.

Use `check` blocks for assertions that should run against real infrastructure on every plan
without blocking it (certificate expiry, endpoint health).

**Test what has logic.** A module that passes six variables to one resource needs no test.
A module with conditionals, `for_each` over derived maps, or a generated policy document
does.

---

## CI/CD

The pipeline, in order:

1. **Pre-commit (local):** `terraform fmt`, `terraform validate`, TFLint, Checkov,
   terraform-docs. Same checks as CI, so failures surface in seconds instead of minutes.
2. **On pull request:** `fmt -check` → `init -backend=false` → `validate` → TFLint (with
   the AWS ruleset) → Checkov/Trivy → `terraform test` → **`terraform plan`, posted as a PR
   comment** → Infracost diff.
3. **Human review** of the plan output. Not the HCL alone — the plan.
4. **On merge to the protected branch:** `terraform apply` with the saved plan file.

```yaml
# plan on PR, apply on merge — the shape, not a drop-in
- run: terraform plan -out=tfplan -input=false -lock-timeout=5m
- run: terraform show -no-color tfplan > plan.txt   # post plan.txt as the PR comment
# on main only:
- run: terraform apply -input=false tfplan          # the same plan, not a fresh one
```

**Apply the saved plan file**, never a fresh `apply -auto-approve`. Applying a re-planned
change is applying something nobody reviewed.

Non-negotiables:

- **Branch protection**: required reviews, required checks, no force-push.
- **`-lock-timeout`** set, so concurrent runs queue rather than fail.
- **Never `-auto-approve` outside a merged, protected-branch pipeline.**
- Plans from **fork PRs run with the read-only role**, or not at all. A plan can exfiltrate
  state contents.
- Environments gated by GitHub Environments with required reviewers for production.

### Drift

Run `terraform plan -detailed-exitcode` on a schedule. Exit code `0` = no changes, `2` =
drift, `1` = error. Alert on `2`.

**Do not auto-remediate production.** Blanket auto-apply of drift is how a one-way-door
attribute change destroys a live database, and how a manual hotfix gets silently reverted
mid-incident. Correct handling: detect → investigate → decide whether code or reality is
wrong → fix through a reviewed PR. Ungated auto-reconciliation is acceptable only in
low-stakes environments.

---

## Toolchain

| Tool | Purpose | Note |
|---|---|---|
| `terraform fmt` | Canonical formatting | `-check -recursive` in CI |
| `terraform validate` | Syntax and internal consistency | Needs `init`; use `-backend=false` |
| **TFLint** | Provider-aware linting, deprecated syntax, unpinned versions | Add `tflint-ruleset-aws` |
| **Checkov** | Misconfiguration and policy scanning of HCL | AWS's named recommendation |
| **Trivy** | Misconfiguration + vulnerability scanning | Successor to tfsec |
| **Infracost** | Cost diff on pull requests | Cost as a review signal |
| **terraform-docs** | Generates input/output tables into README | Enforce in CI |
| **pre-commit** | Runs all of the above locally | `pre-commit-terraform` hooks |

TFLint is **not** a security scanner and Checkov is **not** a linter. Run both.

For policy-as-code beyond scanners: **OPA/Rego** when you want one engine across Terraform,
Kubernetes, and CI; **Sentinel** if you are on HCP Terraform. Whichever you choose, the
decision that actually matters is the **enforcement level** — advisory, soft-mandatory, or
hard-mandatory. Most rollout pain comes from making a rule hard-mandatory before it is
proven, or leaving a critical rule advisory forever.

---

## AWS architecture

The Terraform standards above are the *how*. For the *what* — the architecture decisions
Terraform then encodes — load the relevant reference:

| Question | Reference |
|---|---|
| Is this design sound? What should I review against? | `references/well-architected.md` |
| VPC layout, CIDR planning, subnets, NAT, endpoints, IPAM | `references/networking.md` |
| Account structure, OUs, SCPs, guardrails, landing zone | `references/multi-account.md` |
| Lambda vs Fargate vs EKS vs EC2; which database | `references/service-selection.md` |
| Reducing spend; commitment strategy; cost review | `references/cost.md` |
| Monitoring, alerting, SLOs, DR tiers, RTO/RPO | `references/operations.md` |
| **Something deployed is broken — why?** | `references/debugging.md` |
| What not to do | `references/antipatterns.md` |

Read the reference before advising on that area. Architecture guidance is where confident
wrong answers are most expensive — a bad CIDR plan cannot be fixed later without
renumbering, and a bad account boundary cannot be fixed without a migration.

### Investigating live infrastructure

Debugging a running system is a different activity from building one, and it has its own
rule: **read before you touch.**

- **Never mutate to diagnose.** Restarting the service destroys the evidence and usually
  "fixes" the symptom, guaranteeing a recurrence with the diagnostic trail gone.
- **Anything you change outside Terraform becomes drift** that the next apply reverts.
  When an incident forces an out-of-band change, record it and reconcile it into code the
  same day.
- **Capture time-limited evidence first.** Stopped ECS tasks are retained roughly an hour;
  after that the stop reason is unrecoverable.
- Read-only AWS CLI calls (`describe-*`, `get-*`, `list-*`, `logs tail`) are safe and
  encouraged. `references/debugging.md` has the failure signatures and query patterns.

### The one rule that survives every architecture

**Start from the workload, not the service.** The most common failure in AWS design is
choosing a technology and then bending requirements to fit it. If you cannot name the
specific capability that makes EKS necessary, the answer is ECS Fargate. If the work is
event-driven and finishes in under fifteen minutes, the answer is Lambda. Requirements
first, always.

# AWS Terraform Master

AWS cloud architecture and Terraform engineering standards, bundled with their
enforcement.

Targets **Terraform 1.14** and **AWS provider v6**, with a plan-on-PR / apply-on-merge
GitHub Actions workflow and an S3 backend using native state locking.

## What's in it

| Piece | Purpose |
|---|---|
| `SKILL.md` | The Terraform craft standards — always loaded |
| `references/` | AWS architecture detail, loaded on demand |
| `agents/` | Five specialist subagents |
| `hooks/` + `scripts/` | Deterministic enforcement, scoped to Terraform files only |

### References

Progressive disclosure — read the one relevant to the task rather than loading all of it.

| File | Covers |
|---|---|
| `well-architected.md` | Six pillars and six design principles, as a review lens |
| `networking.md` | CIDR planning, VPC/subnet sizing, NAT, endpoints, connectivity |
| `multi-account.md` | Organizations, OUs, SCPs, security baseline, landing zone |
| `service-selection.md` | Compute, data, and messaging decision tables |
| `cost.md` | Architecture savings before commitments; review checklist |
| `operations.md` | Observability signals, alerting, DR tiers, RTO/RPO |
| `antipatterns.md` | The flag-in-review list |

### Agents

| Agent | Role | Access |
|---|---|---|
| `aws-architect` | Designs topology, selects services, defines state boundaries. Writes `PLAN.md`, never `.tf` | Read/Write (plans only) |
| `tf-implementer` | Writes the Terraform from the plan | Read/Write/Bash |
| `tf-reviewer` | Correctness, structure, maintainability | **Read-only** |
| `aws-security` | Least privilege, secrets, state, exposure. Writes `SECURITY-REPORT.md` | **Read-only** |
| `aws-cost` | Cost drivers and architecture-level savings | **Read-only** |

Typical flow: `aws-architect` → `tf-implementer` → `tf-reviewer` + `aws-security` in
parallel → `aws-cost` before merge.

## Enforcement

Hooks are **scoped to `.tf` and `.tfvars` only**. An infrastructure repo legitimately
contains YAML, Python, Go and Dockerfiles — those are never inspected or reformatted.

**`guard.sh`** (PreToolUse) — the safety layer:

| Command | Decision |
|---|---|
| `apply`/`destroy` with `-auto-approve` | **deny** — bypasses the plan review every control depends on |
| `force-unlock` | **deny** — discards a lock another run may hold |
| `destroy`, `apply` | **ask** |
| `state rm/mv/push`, `taint`, `import` | **ask** — prefer `moved`/`import` blocks |
| `plan`, `fmt`, `validate`, `init` | allow |

It also blocks reads and writes of `*.tfstate`, `.terraform/`, and secret-bearing files.
State holds every managed value in plaintext, so reading it is reading credentials.

**`format.sh`** (PostToolUse) — `terraform fmt` on the edited file. Falls back to `tofu`,
and no-ops cleanly when neither binary is installed.

**`lint-antipatterns.sh`** (PostToolUse) — twelve line-oriented checks with the finding fed
back for fixing: deprecated DynamoDB locking, backend without locking or encryption,
hardcoded secrets, `random_password` landing in state, wildcard IAM actions, heredoc
policies, unpinned module sources, `provider` blocks inside modules, `ignore_changes = all`,
`provisioner` blocks, log groups without retention, and admin ports open to `0.0.0.0/0`.

Comments are stripped before matching, so prose about an anti-pattern does not trigger it.

## Configuration

| Variable | Effect |
|---|---|
| `TF_MASTER_SKIP_RULES` | Comma-separated rule names to disable, e.g. `log_retention,open_admin_port` |
| `TF_MASTER_FORMATTER` | `terraform`, `tofu`, or `none` |

Rule names: `dynamodb_lock`, `backend_lock`, `hardcoded_secret`, `password_in_state`,
`wildcard_iam`, `heredoc_policy`, `unpinned_module`, `module_provider`,
`ignore_changes_all`, `provisioner`, `log_retention`, `open_admin_port`.

## Requirements

`jq` for the hooks (they fail open and stay silent without it). `terraform` or `tofu` for
formatting. TFLint, Checkov, Trivy, Infracost and terraform-docs are recommended in CI but
not required by the hooks.

## Notes

- **OpenTofu** is not the target but the guard and formatter both recognise `tofu`. The HCL
  standards apply unchanged; HCP Terraform and Sentinel guidance does not.
- The standards assume Terraform 1.14 / provider v6 and flag version floors explicitly.
  Older repositories are normal — `SKILL.md` opens with a version-awareness table so
  nothing gets recommended below its floor.

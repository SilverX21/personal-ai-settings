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
| `debugging.md` | Live runtime investigation — ECS stop codes, exit codes, Logs Insights, connectivity, IAM denials |
| `antipatterns.md` | The flag-in-review list |

### Agents

| Agent | Role | Access |
|---|---|---|
| `aws-architect` | Designs topology, selects services, defines state boundaries. Writes `PLAN.md`, never `.tf` | Read/Write (plans only) |
| `tf-implementer` | Writes the Terraform from the plan | Read/Write/Bash |
| `tf-reviewer` | Correctness, structure, maintainability | **Read-only** |
| `aws-security` | Least privilege, secrets, state, exposure. Writes `SECURITY-REPORT.md` | **Read-only** |
| `aws-cost` | Cost drivers and architecture-level savings | **Read-only** |
| `aws-investigator` | Debugs **live** AWS — reads running state, logs, CloudTrail | **Read-only against AWS** |

Build flow: `aws-architect` → `tf-implementer` → `tf-reviewer` + `aws-security` in
parallel → `aws-cost` before merge.

Incident flow: `aws-investigator` alone. It reads live infrastructure and reports findings
with evidence; it never applies a fix, because mutating destroys the evidence and creates
drift.

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
| `aws describe-*`/`get-*`/`list-*`/`logs tail` | allow — investigation stays friction-free |
| `aws delete-*`/`terminate-*`/`revoke-*` | **deny** — desyncs state; change the code instead |
| any other `aws` call, incl. unrecognized verbs | **ask** — unknown is never assumed safe |

It also blocks reads and writes of `*.tfstate`, `.terraform/`, and secret-bearing files.
State holds every managed value in plaintext, so reading it is reading credentials.

`aws` is matched only in invoked-binary position, so `grep -r aws ./docs` is not caught
while `ls && aws ecs delete-service` is.

**`format.sh`** (PostToolUse) — `terraform fmt` on the edited file. Falls back to `tofu`,
and no-ops cleanly when neither binary is installed.

**`lint-antipatterns.sh`** (PostToolUse) — twelve line-oriented checks with the finding fed
back for fixing: deprecated DynamoDB locking, backend without locking or encryption,
hardcoded secrets, `random_password` landing in state, wildcard IAM actions, heredoc
policies, unpinned module sources, `provider` blocks inside modules, `ignore_changes = all`,
`provisioner` blocks, log groups without retention, and admin ports open to `0.0.0.0/0`.

Comments are stripped before matching, so prose about an anti-pattern does not trigger it.

## Tests

```bash
./scripts/test-hooks.sh
```

67 cases over `guard.sh`, `lint-antipatterns.sh` and `format.sh`. Exits non-zero on
failure, so it works as a pre-commit or CI gate. **Run it after touching any script.**

It is not decoration — it caught two real bugs on first run: `rg "terraform destroy"
README.md` was treated as an actual destroy, and `grep -r aws ./docs` as an AWS CLI call,
because the patterns did not require the command to be in invoked-binary position. Both
are now permanent regression cases, alongside wrapper cases (`TF_LOG=debug terraform
apply`, `cd infra && ...`, `sudo aws ...`) proving the anchoring did not open a hole.

The `lint-antipatterns.sh` rules are **line-anchored**, so fixtures must be
`terraform fmt`-style with one attribute per line — which is what the linter sees in
practice, since `format.sh` runs `fmt` on every write.

## Pipeline skill

`/scaffold-stack` runs the whole build pipeline: architect → implementer → reviewer +
security + cost in parallel. It stops for human review after the plan, because account
structure and CIDR allocation cannot be changed later without a migration. It never
applies.

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

- **OpenTofu** is not the target but the guard and formatter both recognize `tofu`. The HCL
  standards apply unchanged; HCP Terraform and Sentinel guidance does not.
- The standards assume Terraform 1.14 / provider v6 and flag version floors explicitly.
  Older repositories are normal — `SKILL.md` opens with a version-awareness table so
  nothing gets recommended below its floor.

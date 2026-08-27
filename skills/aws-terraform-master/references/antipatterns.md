# Anti-patterns

Things that look reasonable in a diff and cause incidents later. Flag these in review.

## State and backends

**Local state, or a backend without locking.** Two concurrent applies corrupt state. There
is no recovery beyond restoring a version and reconciling by hand.

**A new backend using a DynamoDB lock table.** Deprecated since Terraform 1.10. Use
`use_lockfile = true`.

**State bucket without versioning.** Versioning *is* your rollback. Without it, a corrupted
state file is unrecoverable.

**One state for everything.** Every application deploy plans the entire estate, every apply
can reach production networking, and plan times grow until people start using `-target`.

**`-target` as a routine workflow.** It is a break-glass tool. Habitual use means your state
boundaries are wrong; fix those instead.

**`terraform state rm` / `state mv` by hand.** Invisible to review and unrepeatable. Use
`moved` blocks and `import` blocks — refactoring belongs in the diff.

## Secrets

**Secrets in `.tf` or `.tfvars`.** Even in a private repository. Git history is forever and
repositories get cloned, forked, and made public by accident.

**Assuming `sensitive = true` protects a secret.** It hides CLI output. The value is still
plaintext in state. Use write-only arguments or keep the secret out of Terraform entirely.

**Generating passwords with `random_password` and leaving them in state.** Pair it with an
`ephemeral` block and a `*_wo` argument, or generate out of band.

**Long-lived IAM access keys in CI.** Use OIDC. There has been no good reason for stored
AWS keys in GitHub Actions for years.

## IAM

**`Action: "*"` or `Resource: "*"`** outside a genuinely global read-only policy. Start
empty and add what fails.

**One `terraform-admin` role across all environments.** The role that can change dev can
change production.

**Trust policies with wildcard repository conditions** (`repo:acme/*`). Any repository in
the organization can then assume your production role. Scope to repository *and* ref.

**Managed policies like `PowerUserAccess` as a permanent grant.** Fine for a sandbox,
never for a pipeline.

## Module design

**A module wrapping a single resource.** If the module name cannot differ meaningfully from
the resource type, delete the module.

**Deeply nested modules.** Three levels of variable forwarding is unreadable and
undebuggable. Two levels maximum.

**A `provider` block inside a module.** Breaks reuse, multi-region, and `destroy`. Only
`required_providers` belongs in a module.

**Unpinned module sources.** `?ref=main` means your infrastructure changes when someone
else merges. Pin to a commit hash or a version tag.

**Forking a community module to change one thing.** Use variables. Fork only to contribute
upstream.

**Modules with no outputs.** Callers cannot depend on what you built, so Terraform cannot
order it correctly.

## HCL

**`count` for a set of non-identical resources.** Removing the second of three destroys and
recreates the third. Use `for_each`.

**`lifecycle { ignore_changes = all }`.** Permanently blinds you to drift on that resource.
Scope to specific attributes, with a comment saying why.

**`provisioner` and `local-exec` doing real work.** Terraform does not track it. It is
invisible to plan, state, and destroy — and it will not run again on the next apply.

**Heredoc JSON for IAM policies.** No validation, no interpolation checking, unreadable
diffs. Use `aws_iam_policy_document`.

**Inline `ingress`/`egress` blocks in security groups.** Confusing diffs and conflicts with
anything else managing the rules. Use `aws_vpc_security_group_ingress_rule`.

**Hardcoded account IDs, regions, or ARNs in a module.** Pass them in.

**Nested `for` expressions building resources dynamically.** If it takes ten minutes to work
out what it produces, it takes an hour at 3am.

## CI/CD

**`apply -auto-approve` outside a merged protected-branch pipeline.** Applying without a
reviewed plan is applying something nobody has seen.

**Re-planning at apply time instead of applying the saved plan file.** The reviewed plan and
the applied plan are then different artifacts.

**Running plans from fork pull requests with write credentials.** A plan can exfiltrate
state contents.

**Automatic drift remediation in production.** A one-way-door attribute change destroys the
live resource, and auto-revert silently undoes a manual hotfix mid-incident.

**No branch protection.** Every control above is decoration without it.

## AWS architecture

**Overlapping VPC CIDRs.** They cannot peer, cannot share a Transit Gateway route table,
cannot reach each other over Direct Connect. No workaround exists — only renumbering.

**`/24` VPCs "to save space."** Private address space is free; subnet capacity is not.

**No S3/DynamoDB gateway endpoints.** They are free and remove NAT data-processing charges.
There is no argument for omitting them.

**Applications in public subnets.** Public subnets hold load balancers and NAT gateways.
Nothing else.

**Workloads in the Organizations management account.** SCPs do not apply there, and it is
the account that can dissolve the organization.

**Applying an SCP without testing it in a sandbox OU.** One character can lock every
principal out of an account, including the ones you would use to fix it.

**CloudWatch log groups with default retention.** The default is never expire.

**S3 buckets with no lifecycle policy.** Storage grows forever, and nobody notices until
the bill does.

**EKS chosen without a named Kubernetes requirement.** The cost is the upgrade cadence and
the permanent platform team, not the control plane fee.

**A DR plan that has never been executed.** It is a document, not a capability.

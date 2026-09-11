# Testing, CI/CD, and toolchain

Load this when writing tests, a pipeline, or choosing scanners. The non-negotiables live
in `SKILL.md`; this is the procedure and the samples.

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

## Toolchain

| Tool | Purpose | Note |
|---|---|---|
| `terraform fmt` | Canonical formatting | `-check -recursive` in CI |
| `terraform validate` | Syntax and internal consistency | Needs `init`; use `-backend=false` |
| **TFLint** | Provider-aware linting, deprecated syntax, unpinned versions | Add `tflint-ruleset-aws` |
| **Checkov** | Misconfiguration and policy scanning of HCL | AWS's named recommendation |
| **Trivy** | Misconfiguration + vulnerability scanning | Successor to tfsec |
| **Infracost** | Cost diff on pull requests | Diff, not absolute |
| **terraform-docs** | Generates input/output tables into README | Enforce in CI |
| **pre-commit** | Runs all of the above locally | `pre-commit-terraform` hooks |

TFLint is **not** a security scanner and Checkov is **not** a linter. Run both.

For policy-as-code beyond scanners: **OPA/Rego** when you want one engine across Terraform,
Kubernetes, and CI; **Sentinel** if you are on HCP Terraform. Whichever you choose, the
decision that actually matters is the **enforcement level** — advisory, soft-mandatory, or
hard-mandatory. Most rollout pain comes from making a rule hard-mandatory before it is
proven, or leaving a critical rule advisory forever.

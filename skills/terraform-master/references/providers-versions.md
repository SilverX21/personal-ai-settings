---
last_reviewed: 2026-09-11
---

# Terraform, providers, versions, and dependency locking

## Terraform version

Declare a Terraform version constraint that matches the features and compatibility policy of the project:

```hcl
terraform {
  required_version = ">= <minimum-supported-version>, <next-breaking-boundary>"
}
```

Do not copy a version from examples or memory. Check the current environment, CI/HCP runtime, provider requirements, and features actually used.

Version operators include exact (`=`), minimum/range comparisons (`>=`, `<`, etc.), and the pessimistic constraint (`~>`). Use the narrowest constraint that expresses the project's real compatibility policy without creating unnecessary upgrade friction.

## Root vs reusable-module constraints

### Reusable child modules

State the minimum Terraform/provider versions required by features the module uses. HashiCorp guidance for shared modules is generally to avoid overly restrictive provider constraints so the root can select one provider version compatible with all modules.

### Root configurations

The root owns operational reproducibility. Use intentional Terraform/provider bounds compatible with the organization's upgrade policy, and commit/review the dependency lock file.

Do not allow accidental major provider upgrades in production roots.

## Required providers

Each module declares its provider requirements, including source address:

```hcl
terraform {
  required_providers {
    example = {
      source  = "namespace/example"
      version = "<constraint>"
    }
  }
}
```

Provider version constraints belong in `required_providers`, not the `provider` configuration block. The provider-block `version` argument is deprecated.

## Provider configurations and child modules

Provider configurations belong in the root module. A reusable child module declares `required_providers` and, when needed, `configuration_aliases`.

Default provider configurations may be inherited by child modules. Aliased configurations must be passed explicitly when required.

Avoid provider blocks inside reusable child modules: current HashiCorp docs describe provider configurations as root-level/global and document legacy child-module provider configurations as problematic, including incompatibility with module `for_each`, `count`, and `depends_on` patterns.

## `.terraform.lock.hcl`

The dependency lock file records **selected provider versions and package checksums** for a root configuration.

Important rules:

- Generate/update it through `terraform init`.
- Commit it for root configurations so provider selection changes can be reviewed.
- Use `terraform init -upgrade` intentionally when upgrading providers within constraints.
- Review lock-file diffs as dependency changes.
- Do not manually treat it as module version locking.

Current HashiCorp docs explicitly state that the dependency lock file tracks provider dependencies, not remote module version selections. Remote modules are re-selected according to the module source/version constraints.

## Modules and versioning

For registry modules, specify an intentional version constraint. Avoid unbounded major upgrades.

Local module sources do not use a registry version selection; the `version` argument is ignored for local sources.

## Provider upgrades

Before upgrading:

1. Read provider changelog/upgrade guide.
2. Confirm Terraform Core compatibility.
3. Update constraints intentionally.
4. Run `terraform init -upgrade` in a controlled branch.
5. Review `.terraform.lock.hcl`.
6. Run format/validate/tests.
7. Create and inspect a plan in each representative environment.
8. Pay special attention to default changes, deprecated arguments, state migrations, and force-replacement behavior.

## Freshness rule

Exact Terraform/provider versions are changing facts. Verify them against the current HashiCorp/Registry documentation each time they materially affect the answer.

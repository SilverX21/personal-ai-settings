# Post-task hook

Before completing Terraform guidance, verify:

- [ ] The proposed Terraform is valid in principle and matches Terraform's declarative model.
- [ ] Changing/version-sensitive facts were checked against current official docs.
- [ ] Exact provider resource arguments were not guessed.
- [ ] State/backend/workspace implications are understood.
- [ ] Credentials and secrets are not hardcoded or unnecessarily persisted/exposed.
- [ ] Terraform/provider version constraints are intentional.
- [ ] `.terraform.lock.hcl` is described correctly as provider dependency locking.
- [ ] Any create/update/replace/destroy plan semantics are accurately described.
- [ ] Replacements/deletions/state operations include downtime/data-loss/recovery considerations.
- [ ] Module boundaries are cohesive and not over-abstracted.
- [ ] `depends_on`, dynamic blocks, locals, variables, lifecycle rules, and provisioners are used only when justified.
- [ ] Tests/validation are proportional to risk.
- [ ] Mock tests are not presented as proof of real provider behavior.
- [ ] Verification commands/steps are included.
- [ ] The recommendation remains provider agnostic unless provider context was actually needed.

If any item fails, revise before responding.

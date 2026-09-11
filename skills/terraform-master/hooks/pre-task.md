# Pre-task hook

Before substantial Terraform work, classify the task without blocking harmless questions.

```text
What is the user trying to do?
    -> Learn / Build / Review / Refactor / Troubleshoot
    -> Which specialist is primary?
    -> Which smallest set of references is needed?
    -> Which provider(s), if any?
    -> Which Terraform/provider versions matter?
    -> Which state/backend/workspace is involved?
    -> Could this replace, destroy, remove, unlock, or migrate infrastructure/state?
    -> Are credentials, secrets, state, or plan artifacts involved?
    -> Does current documentation need verification?
```

## Questions to answer internally

1. Is this stable Terraform knowledge or changing/version-sensitive behavior?
2. Is provider schema/API behavior involved? If yes, consult the current Registry docs.
3. Is this cloud-platform semantics rather than Terraform behavior? Route platform detail to the relevant platform skill/reference.
4. Is there enough context to make a safe recommendation? Ask only essential questions for destructive/state-sensitive work.
5. Could a simpler Terraform-native design solve the task?

## Risk escalation

Treat as high risk when the proposed action includes destroy/replacement, state mutation, force unlock, backend migration, production identity/network/storage/database changes, or secret exposure.

For high-risk work, require an explicit plan/review/recovery discussion before the operational command.

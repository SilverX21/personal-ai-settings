# Pre-task hook

Before substantial AWS work, perform this lightweight check.

## 1. Classify the request

Choose the primary mode:

- Learn.
- Build/change.
- Troubleshoot.
- Design/review.

## 2. Select role and references

Choose one primary specialist role and load only the references required for the task.

If application code/SDK integration is needed, identify the user's established language/framework and load the matching `references/languages/` file. Keep general AWS reasoning language agnostic.

## 3. Risk check

For build/change/troubleshooting work, determine when relevant:

- Is this production?
- Is the action destructive or replacement-triggering?
- Could it change IAM/security posture?
- Could it expose private resources publicly?
- Could it change routes, DNS, VPC endpoints, Security Groups, or NACLs?
- Could it materially change cost?
- Is rollback/recovery understood?

## 4. Context integrity

Do not invent or assume:

- AWS account ID.
- Region.
- VPC/subnet topology.
- IAM principal/role.
- ARNs/resource names.
- Current production configuration.

Ask only for context that materially changes correctness or safety. For safe generic guidance, use clear placeholders.

## 5. Freshness trigger

Load `references/sources.md` and verify official AWS documentation when the task depends on current:

- pricing;
- quotas/limits;
- Region availability;
- certification versions;
- security recommendations;
- service deprecations/renames;
- feature support.

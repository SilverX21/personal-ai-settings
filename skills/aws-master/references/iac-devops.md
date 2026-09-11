---
last_reviewed: 2026-09-11
---

# AWS IaC, CLI, and DevOps

Use for repeatable infrastructure, automation, deployment, and CI/CD.

## AWS CLI

Useful for inspection, scripting, and repeatable operational steps.

Always make account/Region/profile assumptions explicit when they affect the command.

Docs: https://docs.aws.amazon.com/cli/

## CloudFormation

AWS-native declarative Infrastructure as Code.

Core concepts:

- Templates.
- Stacks.
- Parameters.
- Outputs.
- Resources.
- Change sets.
- Stack events.
- Deletion/replacement behavior.

Before production changes, understand whether a template update modifies in place or replaces a resource.

Docs: https://docs.aws.amazon.com/cloudformation/

## AWS CDK

Code-first IaC framework that synthesizes CloudFormation.

Use when constructs/code improve maintainability and the team accepts that abstraction. Keep constructs understandable; do not hide important infrastructure behavior behind excessive abstraction.

Docs: https://docs.aws.amazon.com/cdk/

## Terraform

Valid when already standardized by the project/team, or when multi-cloud/provider requirements make it appropriate. Do not mix Terraform and CloudFormation/CDK ownership of the same resource set without a deliberate boundary.

## CI/CD authentication

Prefer OIDC/federated role assumption from supported CI systems such as GitHub Actions rather than long-lived AWS access keys stored as CI secrets.

Use least-privilege deployment roles.

## Delivery workflow

A healthy baseline:

source -> test -> build/package -> IaC plan/change set -> deploy -> smoke/health verification -> monitor

For risky changes, include:

- Rollback/recovery plan.
- Database/data migration sequencing.
- Backward compatibility.
- Deployment strategy appropriate to the service.

## AWS-native CI/CD

CodeBuild and CodePipeline may be useful when they fit the project's operational model, but do not prefer them merely because they are AWS-native. Existing GitHub/GitLab/Azure DevOps workflows can deploy to AWS securely.

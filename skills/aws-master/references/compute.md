---
last_reviewed: 2026-09-11
---

# AWS compute

Use for workload hosting and compute service selection.

## EC2

Virtual machines with substantial control over OS, networking, runtime, and instance configuration.

Use when requirements justify infrastructure-level control. Consider operational responsibilities such as patching, AMIs, scaling groups, OS hardening, and instance lifecycle.

Docs: https://docs.aws.amazon.com/ec2/

## Lambda

Event-driven serverless compute. AWS manages the servers/runtime infrastructure around function execution.

Good fit for event handlers, APIs, automation, asynchronous processing, and bursty workloads when the execution/runtime constraints fit.

Consider:

- Execution duration and memory/CPU model.
- Cold starts.
- Concurrency.
- Retry semantics.
- Idempotency.
- Event source behavior.
- VPC attachment/networking when required.

Docs: https://docs.aws.amazon.com/lambda/

## ECS

Managed container orchestration on AWS.

### Fargate

Serverless compute option for ECS (and EKS) where AWS manages the underlying compute capacity.

A common default for teams that want containers without operating EC2 worker fleets or Kubernetes.

Docs: https://docs.aws.amazon.com/ecs/

## EKS

Managed Kubernetes control plane. Use when Kubernetes compatibility/ecosystem requirements justify the operational complexity.

Do not choose EKS simply because the application is containerized.

Docs: https://docs.aws.amazon.com/eks/

## Elastic Beanstalk

Managed application platform that provisions AWS resources for supported application stacks. Useful conceptually, but service selection should consider current project requirements and AWS recommendations.

Docs: https://docs.aws.amazon.com/elasticbeanstalk/

## Selection questions

Ask:

- Does the workload need OS-level control?
- Is it already containerized?
- Is Kubernetes actually required?
- Is the execution event-driven and bounded?
- What scaling pattern exists?
- What networking controls are needed?
- What operational burden can the team own?
- What are the cost drivers at expected utilization?

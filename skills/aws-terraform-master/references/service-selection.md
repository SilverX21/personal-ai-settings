# Choosing AWS services

**Start from the workload, not the service.** The most common architecture failure is
picking a technology first and then bending requirements to fit it. Describe the shape of
the work — duration, trigger, state, scaling profile, team — and the service usually
follows.

## Compute

| Service | Choose when | Avoid when |
|---|---|---|
| **Lambda** | Event-driven, bursty, < 15 min per invocation, no persistent state | Long-running, sustained high throughput, heavy cold-start sensitivity, > 10 GB memory |
| **ECS on Fargate** | Long-running containers, you want no nodes to patch | You need daemonsets, GPUs, or per-node control |
| **ECS on EC2** | Container workloads needing GPUs, specific instance types, or Fargate-uneconomic scale | You do not want to manage capacity |
| **EKS** | You can *name* the Kubernetes capability you need | You cannot |
| **EC2** | Legacy, licensing, or kernel-level requirements | Anything a container or function does as well |
| **App Runner** | A single containerized web service, minimal ops | You need VPC-level control or complex routing |

### The EKS question

**Graduate to EKS only for a named reason**: multi-cloud portability you are actually
exercising, an ecosystem tool you require (service mesh, GitOps operators, custom
controllers), or a platform team serving many tenants. "The team knows Kubernetes" is a
real reason. "It is the industry standard" is not.

If you cannot name the capability, ECS Fargate does the job with a fraction of the
operational surface. The cost of EKS is not the control plane fee — it is the upgrade
cadence, the addon compatibility matrix, and the permanent platform team.

### Lambda's real limits

15-minute maximum execution. 10 GB memory ceiling. Cold starts matter for
latency-sensitive synchronous paths. Per-invocation pricing crosses over against Fargate at
sustained load — model it before committing to Lambda for a constantly-busy API.

## Data

| Need | Service | Notes |
|---|---|---|
| Relational, general purpose | **RDS PostgreSQL** | Default choice. Multi-AZ for prod. |
| Relational, high throughput / fast failover | **Aurora PostgreSQL** | Faster failover, storage autoscaling, read replicas; higher cost |
| Relational, spiky or unpredictable | **Aurora Serverless v2** | Scales in place; verify the floor cost |
| Key-value, single-digit ms, known access patterns | **DynamoDB** | Design the keys first; access patterns are not changeable later |
| Cache / session store | **ElastiCache (Valkey/Redis)** | Not a database. Assume it can be empty. |
| Object storage | **S3** | With lifecycle policies from day one |
| Search | **OpenSearch** | Expensive; consider whether Postgres full-text suffices |
| Analytics / warehouse | **Redshift** or **Athena over S3** | Athena first — no cluster to own |
| Time series | **Timestream** | Or Prometheus-compatible storage if already in that ecosystem |

**Default to PostgreSQL on RDS** unless something specific rules it out. It is the boring
correct answer: mature, well-understood, supports JSON, full-text search, and extensions
that remove the need for a second data store.

**DynamoDB is a commitment, not a database choice.** Its performance comes from designing
tables around known access patterns. If the query patterns are still moving, a relational
database is the lower-risk choice — you can add an index later, but you cannot add an
access pattern to a DynamoDB table without a migration.

## Messaging and events

| Pattern | Service |
|---|---|
| Decoupled point-to-point queue, retries, DLQ | **SQS** |
| Fan-out to many subscribers | **SNS**, or EventBridge for filtering |
| Event routing with content-based rules, third-party sources | **EventBridge** |
| Ordered, replayable stream, multiple independent consumers | **Kinesis Data Streams** |
| Kafka compatibility required | **MSK** |
| Step-by-step orchestration with retries and human approval | **Step Functions** |

**SQS + Lambda is the default async pattern.** Reach for Kinesis when you need ordering and
replay, MSK only when Kafka compatibility is a hard requirement — it is a significant
operational commitment.

**Always configure a dead-letter queue.** A queue without a DLQ silently discards messages
that fail repeatedly, and you find out during the incident review.

## Edge and delivery

- **CloudFront** in front of anything public — static or dynamic. It reduces origin load,
  terminates TLS at the edge, and is where WAF attaches.
- **AWS WAF** on public endpoints. Managed rule groups first; custom rules only for
  something specific.
- **Route 53** for DNS, with health checks driving failover.
- **ALB** for HTTP/HTTPS, **NLB** for TCP/UDP or when you need a static IP.
- **API Gateway** when you need per-route authorization, throttling, usage plans, or
  request validation. Otherwise an ALB in front of a container costs less and does less.

## Decision heuristics

1. **Managed over self-hosted**, unless you can articulate what running it yourself buys.
2. **Boring over new.** A service released last re:Invent has no operational track record,
   thin Terraform provider support, and no answers on the internet at 3am.
3. **The cheapest component is the one you did not deploy.** Every service is an upgrade
   path, a security surface, an IAM policy, and a cost line.
4. **Check Terraform provider coverage before committing.** New AWS services routinely lag
   in the provider, and "we will manage this part by hand" becomes permanent.
5. **Model the cost at expected scale before choosing**, not after. Serverless-vs-provisioned
   crossovers are frequently counter-intuitive.

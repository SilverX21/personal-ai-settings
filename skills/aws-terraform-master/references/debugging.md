# Debugging live AWS

Runtime investigation. The rest of this skill is about building infrastructure; this is
about working out why the thing you built is broken.

## Method

**Establish the facts before forming a theory.** The most expensive debugging mistake is
fixing the second thing you thought of before confirming the first.

1. **What changed?** Almost everything that breaks was working recently. Check deployment
   history, `terraform apply` history, and CloudTrail before anything else.
2. **What is the blast radius?** One task or all of them? One AZ or every AZ? One customer
   or everyone? The shape of the failure identifies the layer.
3. **Read the actual error.** Not the summary in the dashboard — the `stoppedReason`, the
   exception, the exit code. Most AWS errors name their own cause precisely.
4. **Confirm, then fix.** State the hypothesis, find the evidence that would disprove it,
   then act.

**Never mutate to diagnose.** Restarting the service destroys the evidence and often
"fixes" it temporarily, guaranteeing a repeat at a worse time. Capture state first.

**Out-of-band fixes create drift.** If you change something in the console or by CLI to
resolve an incident, it is now different from Terraform and the next apply will revert it.
Record what you changed and reconcile it into code the same day.

---

## ECS task failures

Start here — the stop reason is usually the whole answer.

```bash
# Most recent stopped tasks (they are only retained ~1 hour)
aws ecs list-tasks --cluster CLUSTER --desired-status STOPPED --max-items 10

aws ecs describe-tasks --cluster CLUSTER --tasks TASK_ARN \
  --query 'tasks[0].{stopCode:stopCode,reason:stoppedReason,status:lastStatus,
           containers:containers[].{name:name,exit:exitCode,reason:reason}}'
```

**Stopped tasks are retained for about an hour.** After that the evidence is gone — capture
it early, and rely on CloudWatch Logs and ECS service events for anything older.

### `stopCode` tells you which category

| `stopCode` | Meaning |
|---|---|
| `TaskFailedToStart` | Never ran. Infrastructure/config problem — image, network, IAM, secrets |
| `EssentialContainerExited` | Ran, then an essential container exited. Application problem |
| `ServiceSchedulerInitiated` | ECS stopped it deliberately — deployment, scale-in, or failed health check |
| `UserInitiated` | Somebody stopped it |
| `SpotInterruption` | Capacity reclaimed |

### `TaskFailedToStart` reasons

| Reason | Cause | Check |
|---|---|---|
| `CannotPullContainerError` | Image unreachable or absent | Tag exists? Execution role has ECR perms? **Private subnet with no NAT and no ECR endpoint?** |
| `ResourceInitializationError` | Cannot reach ECR, SSM, or Secrets Manager | Network path — this is a *networking* error, not a secrets error |
| `CannotStartContainerError` | Container failed at start | Entrypoint/command wrong, binary missing, wrong architecture (arm64 image on x86 task) |
| `CannotCreateVolumeError` | Volume config invalid | Mount points, EFS access points |
| `AccessDeniedException` | IAM | Execution role vs task role — see below |

**`ResourceInitializationError` is almost always networking.** A Fargate task in a private
subnet with no NAT gateway and no interface endpoints for ECR/SSM/Secrets Manager cannot
start, and the error names the resource it could not fetch rather than the missing route.

**Execution role vs task role** — the single most common ECS IAM confusion:

- **Execution role** — used by the *ECS agent* before your code runs: pulling the image,
  fetching secrets for the task definition, writing to the log group. Failures here mean
  the task never starts.
- **Task role** — used by *your application* at runtime for AWS API calls. Failures here
  appear as `AccessDenied` in your application logs, not in the stop reason.

### `EssentialContainerExited` — read the exit code

| Exit code | Meaning |
|---|---|
| `0` | Clean exit. The process finished — usually a container that should be long-running but is not |
| `1` | Application error. Read the logs |
| `137` | SIGKILL — **almost always OOM**, or a health check kill |
| `139` | SIGSEGV — segmentation fault |
| `143` | SIGTERM — graceful shutdown, normally a deliberate stop |

**Exit 137 means memory.** Compare actual usage against the task definition's `memory` and
container-level `memoryReservation`. Container Insights holds the history:

```bash
aws cloudwatch get-metric-statistics --namespace ECS/ContainerInsights \
  --metric-name MemoryUtilized --period 60 --statistics Maximum \
  --dimensions Name=ClusterName,Value=CLUSTER Name=ServiceName,Value=SERVICE \
  --start-time 2026-08-27T10:00:00Z --end-time 2026-08-27T11:00:00Z
```

### Service-level events

```bash
aws ecs describe-services --cluster CLUSTER --services SERVICE \
  --query 'services[0].events[:20].[createdAt,message]' --output table
```

Service events explain deployment stalls, capacity problems, and load balancer
registration failures in plain language. Read them before theorising.

### The task starts, then dies repeatedly

That is usually the load balancer health check, not the application. ECS starts the task,
the target group fails it, ECS kills it, and repeat.

- Health check path returns **exactly 200**? A 302 redirect to HTTPS fails the check.
- `HealthCheckTimeoutSeconds` longer than the app's actual cold start?
- Security group on the task allows inbound from the **load balancer's** security group on
  the container port?
- Is there a startup grace period (`healthCheckGracePeriodSeconds`) for a slow boot?

```bash
aws elbv2 describe-target-health --target-group-arn ARN \
  --query 'TargetHealthDescriptions[].{id:Target.Id,state:TargetHealth.State,
           reason:TargetHealth.Reason,desc:TargetHealth.Description}'
```

`Target.ResponseCodeMismatch` and `Target.Timeout` are the two you will see most.

---

## CloudWatch Logs

### Tail live

```bash
aws logs tail /ecs/my-service --follow --since 15m --format short
aws logs tail /aws/lambda/my-fn --since 1h --filter-pattern "ERROR"
```

### Logs Insights

A pipeline of commands separated by `|`. **Put `filter` as early as possible** — filtering
before `stats` scans far less data and costs less.

```bash
QID=$(aws logs start-query --log-group-names /ecs/my-service \
  --start-time $(date -u -v-1H +%s) --end-time $(date -u +%s) \
  --query-string 'fields @timestamp, @message
                  | filter @message like /ERROR/
                  | sort @timestamp desc
                  | limit 50' \
  --query queryId --output text)

aws logs get-query-results --query-id "$QID"
```

`start-query` is asynchronous — poll `get-query-results` until `status` is `Complete`.

### Query patterns worth knowing

```sql
-- Group errors by type to find the dominant failure
filter level = "ERROR"
| parse @message /(?<errType>\w+(Error|Exception))/
| stats count(*) as n by errType
| sort n desc

-- Slowest requests
filter @type = "REPORT"
| stats avg(@duration), max(@duration), pct(@duration, 99) by bin(5m)

-- Lambda cold starts
filter @type = "REPORT" and ispresent(@initDuration)
| stats count(*) as coldStarts, avg(@initDuration) by bin(5m)

-- Follow one request across services
filter @message like /REQUEST_ID_HERE/
| sort @timestamp asc
```

`limit` defaults to 10,000 and caps at 100,000.

---

## Lambda

| Symptom | Cause |
|---|---|
| `Task timed out after N seconds` | Timeout too low, or a downstream call with no timeout of its own |
| `errorType: Runtime.ImportModuleError` | Dependency missing from the deployment package or layer |
| Throttling / `429` | Reserved concurrency, or account concurrency limit |
| Sporadic latency spikes | Cold starts — check `@initDuration` |
| Works in console, fails from another service | Resource-based policy missing the invoking principal |
| Timeout reaching an AWS API | VPC-attached with no NAT and no interface endpoint |

**A VPC-attached Lambda has no internet access by default.** Same failure mode as ECS: it
needs a NAT gateway or interface endpoints. This is the most common Lambda networking bug.

```bash
aws lambda get-function-configuration --function-name FN \
  --query '{timeout:Timeout,mem:MemorySize,vpc:VpcConfig,env:Environment}'
```

---

## Connectivity

Check in this order — it is roughly cheapest-first and matches where the fault usually is:

1. **Security groups** — stateful. Check the *outbound* rule on the source and the
   *inbound* rule on the destination. Reference by security group ID, not CIDR.
2. **Route tables** — is there a route to the destination? For a private subnet, does the
   `0.0.0.0/0` route point at a NAT gateway that actually exists and is in a *public*
   subnet?
3. **NACLs** — stateless, so return traffic on ephemeral ports (1024–65535) needs its own
   rule. Rarely the cause, but brutal when it is.
4. **DNS** — is `enableDnsHostnames`/`enableDnsSupport` on? Private hosted zone associated
   with this VPC?
5. **VPC endpoints** — for private subnets with no NAT, is there an endpoint for the
   service, and does its security group allow 443 from the workload?

**VPC Reachability Analyzer answers this definitively** rather than by inspection:

```bash
aws ec2 create-network-insights-path --source SOURCE_ENI --destination DEST_ENI \
  --protocol tcp --destination-port 443
aws ec2 start-network-insights-analysis --network-insights-path-id PATH_ID
```

Flow logs tell you whether packets arrived and whether they were accepted:

```sql
filter action = "REJECT"
| stats count(*) as rejects by srcAddr, dstAddr, dstPort
| sort rejects desc
```

---

## IAM `AccessDenied`

The error message names the principal, the action, and the resource. Read all three — the
principal is frequently not the one you assumed.

```bash
# Who am I actually?
aws sts get-caller-identity

# Simulate before changing anything
aws iam simulate-principal-policy --policy-source-arn ROLE_ARN \
  --action-names s3:GetObject --resource-arns arn:aws:s3:::bucket/key

# Find the denial in CloudTrail
aws cloudtrail lookup-events --lookup-attributes \
  AttributeKey=EventName,AttributeValue=AssumeRole --max-items 20
```

Denial can come from any of five places, and the message does not always say which:
the identity policy, a resource policy, a **permission boundary**, an **SCP**, or a session
policy. If the identity policy clearly allows it, look upward at the SCP — especially in a
multi-account organization.

---

## RDS

| Symptom | Check |
|---|---|
| Connection timeout | Security group, subnet routing, `publicly_accessible` |
| Connection refused / too many connections | `max_connections` vs actual; missing connection pooling |
| Sudden slowness | Performance Insights; a plan change after statistics shifted |
| Storage full | Autoscaling not enabled, or at its ceiling |
| Failover happened | Events — expected during maintenance windows |
| Burst then collapse | gp2 burst balance exhausted; move to gp3 |

```bash
aws rds describe-events --source-identifier DB_ID --source-type db-instance --duration 1440
```

---

## Terraform runtime problems

**State lock stuck.** A crashed run leaves the lock held. Confirm no run is actually alive
before forcing — `force-unlock` during a live apply corrupts state.

**Plan shows unexpected changes.** Someone changed it outside Terraform. Use
`terraform plan -refresh-only` to see reality vs state without proposing changes.

**Resource exists but Terraform wants to create it.** It is not in state. Use an `import`
block, never `terraform state` surgery.

**`Error: Provider produced inconsistent final plan`** — usually a provider bug or a
computed value used in a `for_each` key. Check the provider changelog for your version.

---

## Read-only commands to reach for first

Safe to run at any time — they change nothing.

```bash
aws sts get-caller-identity                      # which principal am I
aws ecs describe-services --cluster C --services S
aws ecs describe-tasks --cluster C --tasks ARN
aws logs tail GROUP --since 30m
aws elbv2 describe-target-health --target-group-arn ARN
aws cloudtrail lookup-events --max-items 20      # what changed, and who
aws ec2 describe-security-groups --group-ids sg-x
aws ec2 describe-route-tables --filters Name=vpc-id,Values=vpc-x
aws lambda get-function-configuration --function-name FN
aws rds describe-events --source-identifier DB --duration 1440
aws servicequotas list-service-quotas --service-code ecs
```

**CloudTrail first when something changed unexpectedly.** It answers "who did this and
when" faster than any amount of inference from current state.

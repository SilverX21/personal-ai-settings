# Observability and resilience

## Observability

**CloudWatch and X-Ray do different jobs and do not replace each other.** CloudWatch is for
detection and log detail; X-Ray is for request-path causality and where the time went. The
normal workflow is: alarm fires in CloudWatch → find the failing requests → open the trace
in X-Ray → read the logs for that trace.

**OpenTelemetry is the instrumentation standard to build on.** Use ADOT (AWS Distro for
OpenTelemetry). It keeps the instrumentation in your application portable if the backend
ever changes, which is the part that is expensive to redo.

### The three signals

- **Logs** — structured JSON, always. A log line that requires a regex to parse is a log
  line you will not query during an incident. Include the trace ID in every entry.
- **Metrics** — RED for services (Rate, Errors, Duration) and USE for resources
  (Utilization, Saturation, Errors). Use **Embedded Metric Format** to emit metrics from
  logs rather than making a separate PutMetricData call per event.
- **Traces** — propagate context across every service boundary, including through SQS and
  EventBridge. A trace that stops at the queue is half a trace.

### Alerting

**Alarm on symptoms, not causes.** "p99 latency above SLO" is actionable; "CPU above 80%"
is usually not — high CPU on a healthy service is a service doing its job.

- **Use anomaly detection instead of static thresholds** for anything with a daily or
  weekly pattern. A static threshold on diurnal traffic is either noisy at night or blind
  during the day.
- Every alarm needs a **runbook link** and a named owner. An alarm nobody knows how to act
  on gets muted, and then the muting outlives the reason.
- Alarm on the **absence** of expected events too — a cron that stops running produces no
  errors at all.
- **CloudWatch Application Signals** gives SLO tracking and error-budget burn without
  building it yourself. **Synthetics** canaries catch "the site is down" before a user
  reports it.

### Retention

CloudWatch Logs default to never expiring. Set retention explicitly on every log group, in
the same Terraform module that creates the thing producing the logs. Ship anything needing
long retention to S3 with a lifecycle policy — it is an order of magnitude cheaper.

## Resilience and disaster recovery

### Pick a tier from RTO and RPO

**RTO** = how long you can be down. **RPO** = how much data you can lose. State both as
numbers before designing anything — the tier follows from them, and cost follows from the
tier.

| Strategy | RPO | RTO | Cost | Shape |
|---|---|---|---|---|
| **Backup & restore** | Hours | < 24h | Lowest | Backups to S3, cross-region copy. Rebuild on demand. |
| **Pilot light** | Minutes | Hours | Low | Data replicated continuously; compute defined but not running. |
| **Warm standby** | Seconds | Minutes | Medium | Scaled-down but fully functional copy, always running. |
| **Multi-site active/active** | Near zero | Near zero | Highest | Serving from multiple regions simultaneously. |

**Most workloads need pilot light or warm standby.** Active/active is expensive and forces
hard problems — data consistency, split-brain, per-region correctness — that most systems
do not need to solve. Do not buy it by default.

Terraform is what makes pilot light practical: the same modules, a different tfvars and
region, applied when you need the compute.

### Multi-AZ first

Multi-AZ is not disaster recovery — it is baseline availability, and it is cheap. Get it
right before considering multi-region:

- Compute across three AZs behind a load balancer.
- RDS/Aurora Multi-AZ. Aurora fails over faster.
- One NAT gateway per AZ (see `networking.md`).
- No stateful dependency pinned to a single AZ.

### Testing

**A DR plan that has never been executed is a document, not a capability.** Schedule game
days. Fail over for real, in production, on purpose, with the team that would do it at 3am.
Measure the actual RTO and compare it to the stated one — the gap is always instructive.

Test **restores**, not backups. A backup you have never restored is an untested assumption.

### Designing for failure

- **Timeouts on every network call.** A call without a timeout is an outage waiting for a
  slow dependency.
- **Retries with exponential backoff and jitter.** Synchronized retries are a
  self-inflicted DDoS.
- **Circuit breakers** so a failing dependency degrades one feature rather than exhausting
  every thread.
- **Graceful degradation** — decide in advance what the system does without its cache, its
  search index, or its recommendation service.
- **Know your quotas** before you hit them. Service limits are a normal cause of production
  incidents and are visible in advance.

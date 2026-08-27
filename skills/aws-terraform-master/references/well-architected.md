# AWS Well-Architected Framework

The review lens. Use it to evaluate a design, structure an architecture discussion, or
decide what to raise in review. It is **not an audit checklist** — the value is in the
trade-off conversation, not in scoring.

## General design principles

AWS's six principles for cloud design, and what each actually means in practice:

1. **Stop guessing capacity.** Provision to observed demand with autoscaling instead of
   sizing for a peak you estimated in a spreadsheet. Over-provisioning is the single most
   common source of cloud waste.
2. **Test at production scale.** A production-scale test environment costs only what it
   costs while it runs. Terraform makes this cheap — the same module, a different tfvars.
3. **Automate with architectural experimentation in mind.** Automation lets you create,
   replicate, and revert environments cheaply. This is the argument for IaC itself.
4. **Consider evolutionary architectures.** Design decisions are not one-time events.
   Assume you will revisit them, and avoid choices that foreclose change (overlapping
   CIDRs, single-account designs, unversioned modules).
5. **Drive architectures using data.** Instrument, then decide. "It feels slow" is not a
   reason to change an architecture; a latency histogram is.
6. **Improve through game days.** Rehearse failure on a schedule. A DR plan that has never
   been executed is a document, not a capability.

## The six pillars

### Operational Excellence

Running, monitoring, and improving workloads. Focus areas: organization, prepare, operate,
evolve.

Review questions: How do you know the workload is healthy? How does a change reach
production? What happens at 3am — is there a runbook, and has anyone followed it? Are
operations procedures themselves code?

### Security

Protecting information, systems, and assets. Focus areas: security foundations, identity
and access management, detection, infrastructure protection, data protection, incident
response, application security.

Review questions: Where are the trust boundaries? Is every identity least-privileged, and
how do you know? Is data encrypted at rest and in transit, with keys you control? Would you
detect a compromise, and how fast? Can you revoke access in one action?

### Reliability

Performing the intended function correctly and consistently, and recovering from failure.

Review questions: What is the single point of failure? What are the stated RTO and RPO, and
has recovery been tested against them? What happens when a dependency is slow rather than
down? Are quotas and limits understood before they are hit?

### Performance Efficiency

Using computing resources efficiently as demand and technology change.

Review questions: Is the compute type matched to the workload shape? What is the actual
bottleneck — measured, not assumed? Is there a managed service that removes this work
entirely?

### Cost Optimization

Delivering business value at the lowest price point.

Review questions: Who owns this spend, and can they see it? What is the unit cost, per
tenant or per request? What is running that nobody uses? See `cost.md`.

### Sustainability

Minimizing environmental impact.

Review questions: Is utilization high enough to justify the footprint? Would Graviton and
right-sizing reduce it? Are you storing data forever because nobody set a lifecycle policy?
This pillar and Cost Optimization usually point at the same fix.

## Using this in review

Pick the two or three pillars the change actually touches. A pull request adding an S3
bucket raises Security (encryption, public access, access logging) and Cost (lifecycle
policy, storage class) — dragging it through all six is theater.

The highest-value review question is almost always the same: **what happens when this
fails?** Most designs are specified for the happy path and discovered in production.

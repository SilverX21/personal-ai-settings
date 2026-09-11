# terraform-master

`terraform-master` is a reusable Agent Skill for production-grade Terraform and Infrastructure as Code work. It can teach Terraform, write and review HCL, design module/state architecture, troubleshoot plans and applies, guide safe refactors/imports, and review security and CI/CD workflows.

The skill intentionally keeps **Terraform knowledge** separate from **cloud-platform knowledge**. It knows how Terraform interacts with AWS and Azure, but it does not try to replace an AWS- or Azure-specific skill.

## Design goals

- Correct and predictable Terraform changes.
- Safe state and backend handling.
- Small, cohesive module interfaces.
- Readable HCL over clever abstraction.
- Native Terraform capabilities before unnecessary third-party tooling.
- Current HashiCorp guidance for changing behavior.
- Progressive disclosure so the orchestrator stays small.

## Directory structure

```text
terraform-master/
├── SKILL.md
├── README.md
├── agents/
│   ├── terraform-fundamentals-mentor.md
│   ├── terraform-developer.md
│   ├── terraform-architect.md
│   ├── terraform-module-reviewer.md
│   ├── terraform-ops-troubleshooter.md
│   └── terraform-security-reviewer.md
├── references/
│   ├── README.md
│   ├── sources.md
│   ├── fundamentals.md
│   ├── style-conventions.md
│   ├── configuration-language.md
│   ├── providers-versions.md
│   ├── modules.md
│   ├── state-backends.md
│   ├── testing-validation.md
│   ├── security-secrets.md
│   ├── workflows-cicd.md
│   ├── refactoring-migrations.md
│   └── providers/
│       ├── aws.md
│       └── azure.md
├── hooks/
│   ├── README.md
│   ├── pre-task.md
│   ├── post-task.md
│   ├── reference-freshness.py
│   └── manifest.example.yaml
└── scripts/
    └── validate_skill.py
```

## Progressive disclosure

`SKILL.md` is the router and safety contract. It should not become a Terraform encyclopedia.

A task loads only the references it needs. For example:

- A beginner question loads `fundamentals.md` and perhaps `configuration-language.md`.
- A reusable-module review loads `modules.md`, `providers-versions.md`, and `testing-validation.md`.
- An S3 backend problem loads `state-backends.md`, `security-secrets.md`, and `providers/aws.md`.
- An Azure provider authentication issue loads `providers/azure.md` plus the current Registry/HashiCorp documentation.

Current official documentation always wins over a local reference.

## Specialist agents

Agent files are concise role cards. They define focus, inputs, process, references, and output expectations. They do not duplicate the detailed reference layer.

Use one primary specialist whenever possible. Add a second specialist only when the task genuinely crosses domains, such as architecture + security or troubleshooting + provider-specific behavior.

## References

Every reference includes `last_reviewed` metadata. References contain mental models, decision rules, pitfalls, commands, and links to official sources. They are deliberately summarized instead of copying large amounts of vendor documentation.

`references/sources.md` is the authoritative index. At the package review date, the HashiCorp Terraform documentation site labels the v1.16.x documentation as latest. That observation is metadata, not a permanent compatibility claim; the skill must re-check current docs whenever the actual latest version matters.

## Provider references

Provider references describe the Terraform/provider boundary only:

- `references/providers/aws.md`: AWS provider configuration/authentication, aliases, default tags, and S3 backend considerations.
- `references/providers/azure.md`: AzureRM, AzAPI, Azure authentication, aliases, and Azure Blob backend considerations.

They intentionally avoid re-teaching AWS or Azure platform internals.

To add another provider later:

1. Create `references/providers/<provider>.md` with freshness metadata.
2. Add official Registry and cloud-provider sources to `references/sources.md`.
3. Add routing guidance to `SKILL.md` only if it materially changes routing.
4. Update `scripts/validate_skill.py` if the new provider becomes required.
5. Keep cloud-platform semantics in the platform-specific skill/reference layer.

## Hooks

`hooks/pre-task.md` classifies the task, risk, provider, versions, backend/state, and freshness needs before work begins.

`hooks/post-task.md` is the completion gate for safety, correctness, complexity, tests, and verification.

`hooks/reference-freshness.py` recursively checks `references/**/*.md` for `last_reviewed` metadata. It reports fresh, stale, and missing metadata and never rewrites files.

Run it with:

```bash
python3 hooks/reference-freshness.py
```

Default warning threshold: 45 days.

## Structural validation

Run:

```bash
python3 scripts/validate_skill.py
```

The validator checks required files, freshness metadata, internal Markdown links, reference routing from `SKILL.md`, absence of an unnecessary GCP provider reference, and a basic provider-agnostic guard for the core skill.

## Current limitations

- Provider resource arguments and deprecations change independently of Terraform Core; exact resource behavior must be checked against the current Registry documentation.
- The package starts with AWS and Azure provider references only.
- The references intentionally summarize official documentation; they are not an offline copy of HashiCorp docs.
- The structural validator cannot prove semantic correctness of arbitrary Terraform configurations. It validates this skill package, not user infrastructure.

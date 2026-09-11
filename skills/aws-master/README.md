# aws-master

`aws-master` is a reusable Agent Skill for learning, designing, building, reviewing, troubleshooting, and operating AWS solutions.

The core skill is **programming-language agnostic**. Language-specific SDK/application guidance is isolated under `references/languages/`.

## Structure

```text
aws-master/
├── SKILL.md
├── README.md
├── agents/
│   ├── README.md
│   ├── aws-fundamentals-mentor.md
│   ├── aws-cloud-developer.md
│   ├── aws-architect.md
│   ├── aws-ops-troubleshooter.md
│   ├── aws-security-reviewer.md
│   └── aws-cost-governance.md
├── references/
│   ├── README.md
│   ├── sources.md
│   ├── fundamentals.md
│   ├── compute.md
│   ├── networking.md
│   ├── identity-security.md
│   ├── storage-data.md
│   ├── messaging-events.md
│   ├── observability-troubleshooting.md
│   ├── governance-cost.md
│   ├── iac-devops.md
│   └── languages/
│       ├── README.md
│       ├── dotnet.md
│       ├── javascript-typescript.md
│       └── python.md
├── hooks/
│   ├── README.md
│   ├── pre-task.md
│   ├── post-task.md
│   ├── manifest.example.yaml
│   └── reference-freshness.py
└── scripts/
    └── validate_skill.py
```

## Design principles

- Keep `SKILL.md` focused on routing, behavior, safety, and decision-making.
- Load only the relevant references for the current task.
- Use official AWS documentation as the source of truth for changing facts.
- Keep architecture/service selection language-neutral.
- Load language references only when implementation code or SDK integration is needed.
- Prefer least privilege, temporary credentials, managed services, evidence-driven troubleshooting, and cost awareness.

## Bundled language references

- .NET / C# / ASP.NET Core
- JavaScript / TypeScript / Node.js / NestJS
- Python

Java is intentionally not included.

## Validation

Run:

```bash
python3 scripts/validate_skill.py
python3 hooks/reference-freshness.py
```

## Hooks

`hooks/` is a client-neutral extension. Agent Skills does not define one universal hook lifecycle, so each host can map these files into its own pre/post-task mechanism.

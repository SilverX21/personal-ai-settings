# Azure Master reference index

These files are curated routing/reference notes for the skill. They are intentionally smaller than the official Microsoft documentation.

Use only the reference files relevant to the current task.

| Topic | File |
|---|---|
| Official source index and freshness policy | `references/sources.md` |
| Fundamentals, AZ-900, hierarchy, regions | `references/fundamentals.md` |
| Compute and application hosting | `references/compute.md` |
| Networking | `references/networking.md` |
| Identity and security | `references/identity-security.md` |
| Storage and databases | `references/storage-data.md` |
| Observability and troubleshooting | `references/observability-troubleshooting.md` |
| Governance and cost | `references/governance-cost.md` |
| IaC, Bicep, Azure CLI, CI/CD | `references/iac-devops.md` |

## Language-specific implementation references

Load these only when application code, SDK usage, or framework-specific integration is relevant.

| Stack | File |
|---|---|
| .NET / C# / ASP.NET Core | `references/languages/dotnet.md` |
| JavaScript / TypeScript / Node.js / NestJS | `references/languages/javascript-typescript.md` |
| Python | `references/languages/python.md` |

The skill is language agnostic by default. If a requested language has no bundled reference, keep Azure reasoning language neutral and use current official Azure developer documentation for language-specific details.

## Freshness

Each substantive reference includes `last_reviewed`. Run:

```bash
python3 hooks/reference-freshness.py
```

A stale local reference is a signal to re-check official Microsoft documentation, not a reason to keep using old guidance.

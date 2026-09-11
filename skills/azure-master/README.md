# azure-master

A reusable, programming-language-agnostic Azure Agent Skill for learning, cloud application development, architecture, operations, troubleshooting, security, governance, and cost awareness.

## Structure

```text
azure-master/
├── SKILL.md
├── README.md
├── agents/
├── references/
│   └── languages/
├── hooks/
└── scripts/
```

The portable Agent Skills core is `SKILL.md` plus the supporting `references/` and `scripts/` resources. `agents/` and `hooks/` are intentionally included as extensions for clients/harnesses that support those concepts.

## Design principles

- Official Microsoft documentation is the source of truth.
- Progressive disclosure: load only the relevant reference files.
- Practical Azure independence over exam memorization.
- Programming-language agnostic by default.
- Language-specific SDK/framework guidance is isolated under `references/languages/`.
- Bundled language references: .NET/C#, JavaScript/TypeScript/Node.js including NestJS, and Python.
- Managed identity, least privilege, observability, networking, and cost awareness are first-class concerns.
- Prefer simple managed Azure services over unnecessary platform complexity.

## Language selection

When implementation code is needed, use the user's explicitly requested language or the language established by the current project, then load the matching language reference. Do not let application-language conventions leak into general Azure architecture guidance.

## Validation

Run:

```bash
python3 scripts/validate_skill.py
python3 hooks/reference-freshness.py
```

If `skills-ref` is available in your environment, you can also validate the Agent Skills metadata with:

```bash
skills-ref validate .
```

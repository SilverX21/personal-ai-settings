# <PROJECT NAME>

<One line: what this API does.>

.NET 10 / C# 14 backend. Solo development (Nuno Araújo).
Code, comments, commits, docs and chat: **US English**.

## Always load

| File                                      | Load when                              |
| ----------------------------------------- | -------------------------------------- |
| `.claude/rules/communication-style.md`    | Every response                         |
| `.claude/rules/engineering-principles.md` | Start of any coding task               |
| `.claude/rules/workflow.md`               | Start of any coding task               |
| `.claude/skills/dotnet-master/SKILL.md`   | **Any** .NET / C# / API / EF Core work |
| `.claude/rules/code-review.md`            | Running or reviewing a code review     |
| `.claude/rules/collaboration.md`          | Handoff, scope decisions               |
| `.claude/rules/model-policy.md`           | Writing or configuring agents/skills   |

Load the rule _before_ the work. `dotnet-master` is the single source of truth for
.NET standards — never restate them in this file.

## Non-negotiables

- **Honesty:** never assume. Ambiguous requirement → `/grill-me`, never invent.
- **Never commit.** Done → stop and hand off per `collaboration.md`.
- **Tests:** unit + integration, per `workflow.md`. Not done with failing or missing tests.
- **No hardcoded business values** → DB config table or `appsettings.json`.
- **Money logic is backend-only.** Never trust a client for money math.
- **New NuGet packages need approval.** Pin latest stable, never prerelease, never wildcards.

## Workflow

1. Unclear requirements → `/grill-me`
2. Follow `workflow.md`. Complex feature → `/dotnet-master` → `dotnet-architect`
   to plan, confirm with Nuno
3. `/ponytail` — laziest solution that actually works
4. Write the code
5. `dotnet-reviewer` + `dotnet-tester`; anything touching auth, tokens, payments,
   user data, uploads or public endpoints → `dotnet-security` **before** handoff
6. Hand off, don't commit

## Skills

- `/dotnet-master` — all backend work, plus its five subagents
- `context7` MCP — first choice for library docs; web search is the fallback
- `/caveman` — chat replies and internal notes only, never docs or user-facing copy

## Do not

- Load `shadcn`, `impeccable`, `frontend-design`, or the Vercel React skills — no frontend here
- Return domain entities from endpoints — DTOs/records only
- Hand-roll a `Result<T>` — `ErrorOr` is the one result type

## Architecture

```
<Solution>.slnx
├── <Solution>.Api             ← Minimal API endpoints (IEndpoint), middleware, DI
├── <Solution>.Application     ← Use cases, DTOs, interfaces
├── <Solution>.Domain          ← Entities, value objects, domain rules
├── <Solution>.Infrastructure  ← EF Core, external APIs
└── <Solution>.Tests           ← xUnit v3, NSubstitute, Testcontainers
```

## Commands

```bash
dotnet run    --project <Solution>.Api
dotnet test
dotnet ef migrations add <Name> --project <Solution>.Infrastructure
dotnet ef database update      --project <Solution>.Infrastructure
dotnet user-secrets set "ConnectionStrings:Db" "..." --project <Solution>.Api
```

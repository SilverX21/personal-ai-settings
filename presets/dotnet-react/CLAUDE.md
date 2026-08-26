# <PROJECT NAME>

<One line: what this product does and who it's for.>

Monorepo: .NET 10 backend + React 19 frontend. Solo development (Nuno Araújo).
Code, comments, commits, docs and chat: **US English**.
User-facing copy: **European Portuguese (pt-PT)**, never pt-BR.

## Always load

| File                                      | Load when                               |
| ----------------------------------------- | --------------------------------------- |
| `.claude/rules/communication-style.md`    | Every response                          |
| `.claude/rules/engineering-principles.md` | Start of any coding task                |
| `.claude/rules/workflow.md`               | Start of any coding task                |
| `.claude/skills/dotnet-master/SKILL.md`   | Any .NET / C# / API / EF Core work      |
| `.claude/rules/code-review.md`            | Running or reviewing a code review      |
| `.claude/rules/collaboration.md`          | Handoff, scope decisions                |
| `.claude/rules/model-policy.md`           | Writing or configuring agents/skills    |
| `docs/backlog/SUMMARY.md`                 | Planning, picking work, updating status |

Load the rule _before_ the work. Never read a whole epic file — grep the story ID.

## Non-negotiables

- **Honesty:** never assume. Ambiguous requirement → `/grill-me`, never invent.
- **Never commit.** Done → stop and hand off per `collaboration.md`.
- **Tests:** unit + integration, backend **and** frontend, per `workflow.md`.
  Not done with failing or missing tests.
- **No hardcoded business values** → DB config table or `appsettings.json`.
- **Money/commission logic is backend-only.** Never trust the frontend for money math.
- **New packages need approval.** Stack packages are free to use.

## Workflow

1. Pick work from `docs/backlog/SUMMARY.md` — next unblocked `todo`, confirm, mark `wip`
2. Unclear requirements → `/grill-me` before writing anything
3. Follow `workflow.md`. Complex feature → plan first and confirm
4. `/ponytail` — laziest solution that actually works
5. **Backend:** `/dotnet-master` → `dotnet-architect` to plan
   **Frontend:** `/vercel-composition-patterns` to plan component architecture
6. Write the code
7. **Backend:** `dotnet-reviewer` + `dotnet-tester`; auth/payments/user data → `dotnet-security`
   **Frontend:** `/vercel-react-best-practices` to review, `/impeccable` for UI polish
8. Update story status in `SUMMARY.md` (status lives _only_ there)
9. Hand off, don't commit

## Skills

| Trigger                                        | Load                                        |
| ---------------------------------------------- | ------------------------------------------- |
| Any .NET / C# work                             | `/dotnet-master` (+ its five subagents)     |
| New or changed React components, data fetching | `/vercel-react-best-practices`              |
| Extracting shared component primitives         | `/vercel-composition-patterns`              |
| `npx shadcn add`, new UI primitive             | `/shadcn`                                   |
| Visual pass **after** it works                 | `/impeccable`                               |
| Library / framework docs                       | `context7` MCP (web search is the fallback) |
| Chat replies and internal notes only           | `/caveman`                                  |

## Do not

- Load `nextjs` or Vercel hosting skills — this is Vite, not Next.js
- Return domain entities from endpoints — DTOs/records only
- Hand-roll a `Result<T>` — `ErrorOr` is the one result type
- `useEffect` + `fetch` for server state — TanStack Query
- Barrel `index.ts` files

## Architecture

```
apps/
  api/                    ← .NET 10 solution, Clean Architecture
    <Sln>.Api             ← Minimal API endpoints (IEndpoint), middleware, DI
    <Sln>.Application     ← Use cases, DTOs, interfaces
    <Sln>.Domain          ← Entities, value objects, domain rules
    <Sln>.Infrastructure  ← EF Core, external APIs
    <Sln>.Tests           ← xUnit v3, NSubstitute, Testcontainers
  web/                    ← React 19 + TypeScript + Vite
    src/features/         ← group by domain, not by type
    src/components/       ← shared UI only
    src/lib/              ← api client, i18n, utils
infra/                    ← Docker Compose
docs/backlog/             ← SUMMARY.md + 00-index.md + epic files
```

**Multi-tenancy:** `HasQueryFilter` on every EF Core entity — all queries tenant-scoped.

## Frontend stack

| Concern      | Choice                          | Constraint                     |
| ------------ | ------------------------------- | ------------------------------ |
| Tables       | TanStack Table                  | No alternatives                |
| Server state | TanStack Query                  | No `useEffect` + `fetch`       |
| UI state     | Zustand                         | —                              |
| Forms        | React Hook Form + Zod           | Zod schema first, derive types |
| i18n         | i18next, `en` + `pt-PT` day one | No hardcoded UI strings        |
| Styling      | Tailwind + shadcn/ui            | No inline styles               |

TypeScript strict — no `any`, no `@ts-ignore`. Named exports (except pages/routes).
No `console.log` in production. Page past ~200 lines → split into components.

## Commands

```bash
make up            # Postgres + Mailpit + Seq
pnpm install
pnpm dev           # FE + BE
pnpm test          # both suites
pnpm build
dotnet ef migrations add <Name> --project apps/api/<Sln>.Infrastructure
```

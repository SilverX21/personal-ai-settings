# <PROJECT NAME>

<One line: what this site is and who it's for.>

Next.js App Router + TypeScript, full-stack. Solo development (Nuno Araújo).
Code, comments, commits, docs and chat: **US English**.
Website content and user-facing UI: **European Portuguese (pt-PT)**, never pt-BR.

## Always load

| File                                      | Load when                            |
| ----------------------------------------- | ------------------------------------ |
| `.claude/rules/communication-style.md`    | Every response                       |
| `.claude/rules/engineering-principles.md` | Start of any coding task             |
| `.claude/rules/workflow.md`               | Start of any coding task             |
| `.claude/rules/code-review.md`            | Running or reviewing a code review   |
| `.claude/rules/collaboration.md`          | Handoff, scope decisions             |
| `.claude/rules/model-policy.md`           | Writing or configuring agents/skills |
| `.claude/rules/graphify.md`               | Only if `graphify-out/` exists       |

Load the rule _before_ the work, not after.

## Non-negotiables

- **Honesty:** never assume. Ambiguous requirement → `/grill-me`, never invent.
- **Never commit.** Done → stop and hand off per `collaboration.md`.
- **Tests** per `workflow.md`. Full suite is pre-push / CI.
- **No hardcoded copy** — if the client might want to change it, it goes in the CMS/DB.
- **New packages need approval.** Stack packages are free to use.
- Unknowns → `docs/pending-questions.md` as a new `P-xx`. Never invent client facts.

## Workflow

1. Unclear scope or AC, **and** the answer would change code → `/grill-me`
2. Follow `workflow.md`. Complex feature → plan first, confirm
3. `/ponytail` — laziest solution that actually works
4. Plan component architecture → `/vercel-composition-patterns`
5. Write the code
6. Review → `/vercel-react-best-practices`; auth, sessions, Server Actions, uploads,
   headers or email → security review before handoff
7. Visual pass **after it works** → `/impeccable`
8. Hand off, don't commit

Reviews are risk-based. Skip the stack on comment/docs-only and tiny local fixes.

## Skills

| Trigger                                                 | Load                                  |
| ------------------------------------------------------- | ------------------------------------- |
| Library / framework docs (Next.js cache, Drizzle, Zod…) | `context7` MCP                        |
| New or changed RSC pages, data fetching                 | `/vercel-react-best-practices`        |
| Routing, Cache Components, middleware vs `proxy.ts`     | Vercel `nextjs` skill                 |
| Extracting shared primitives                            | `/vercel-composition-patterns`        |
| `npx shadcn add`, new primitive                         | `/shadcn`                             |
| Visual pass after it works                              | `/impeccable`                         |
| Accessibility / interface audit                         | `/web-design-guidelines`              |
| Cross-module "how does X relate to Y"                   | `graphify query` / `path` / `explain` |
| Chat replies and internal notes only                    | `/caveman`                            |

## Do not

- Load `dotnet-master` — no .NET here
- Load `frontend-design` by default — it fights an established brand. Only on an
  explicit redesign request
- Copy helpers across features. Shared code goes in `src/lib/`
- Dump `graphify-out/GRAPH_REPORT.md` into context — query it instead

## Stack

- **Next.js** (App Router) + **TypeScript**, full-stack
- **Tailwind** + **shadcn/ui**, dark mode
- **<Drizzle / Prisma>** ORM, **<Postgres / D1>**
- **Vitest** (unit/integration) + **Playwright** (E2E)

TypeScript strict — no `any`, no `@ts-ignore`. Named exports (except pages/routes).
No inline styles. No `console.log` in production.

## Conventions

- Commits: Conventional Commits (`feat:` `fix:` `docs:` `chore:` `refactor:` `test:`)
- Branch: `main`

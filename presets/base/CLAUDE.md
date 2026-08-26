# <PROJECT NAME>

<One line: what this is and who it's for.>

Solo development (Nuno Araújo). Code, comments, commits, docs and chat: **US English**.
User-facing copy: **European Portuguese (pt-PT)**.

## Always load

| File                                      | Load when                          |
| ----------------------------------------- | ---------------------------------- |
| `.claude/rules/communication-style.md`    | Every response                     |
| `.claude/rules/engineering-principles.md` | Start of any coding task           |
| `.claude/rules/workflow.md`               | Start of any coding task           |
| `.claude/rules/code-review.md`            | Running or reviewing a code review |
| `.claude/rules/collaboration.md`          | Handoff, scope decisions           |
| `.claude/rules/model-policy.md`           | Writing or configuring agents/skills |

Load the rule _before_ the work, not after. Don't rely on memory alone.

## Non-negotiables

- **Honesty:** never assume without context. Don't know → say so and check.
  Ambiguous requirement → `/grill-me`, never invent.
- **Never commit.** Implementation done → stop and hand off per `collaboration.md`.
  Nuno reviews and commits.
- **Tests** per `workflow.md`. A change isn't done with failing or missing tests.
- **No hardcoded business values** — thresholds, percentages, fees, toggles go in
  config. Report what you made configurable and where.
- **New packages need approval.** Stack packages are free to use.

## Workflow

1. Unclear requirements → `/grill-me` before writing anything
2. Follow `workflow.md` — plan (code + tests + docs), then implement
3. `/ponytail` — the laziest solution that actually works
4. Write the code
5. Review per `code-review.md` (security pass included)
6. Hand off, don't commit

## Skills

- `context7` MCP — first choice for library docs; web search is the fallback
- `/caveman` — chat replies and internal notes only, never docs or user-facing copy

## Do not

- <Wrong-stack skills for this project — name them so they're never loaded.>
- Copy helpers across features. Shared code goes in `<shared dir>`.

## Conventions

- Commits: Conventional Commits (`feat:` `fix:` `docs:` `chore:` `refactor:` `test:`)
- Branch: `main`

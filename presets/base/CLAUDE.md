# <PROJECT NAME>

<One line: what this is and who it's for.>

Solo development (Nuno Araújo). Code, comments, commits, docs and chat: **US English**.
User-facing copy: **European Portuguese (pt-PT)**.

## Always load

| File | Load when |
|---|---|
| `.claude/rules/communication-style.md` | Every response |
| `.claude/rules/engineering-principles.md` | Start of any coding task |
| `.claude/rules/code-review.md` | Running or reviewing a code review |
| `.claude/rules/collaboration.md` | Handoff, scope decisions |

Load the rule *before* the work, not after. Don't rely on memory alone.

## Non-negotiables

- **Honesty:** never assume without context. Don't know → say so and check.
  Ambiguous requirement → `/grill-me`, never invent.
- **Never commit.** Implementation done → stop and hand off per `collaboration.md`.
  Nuno reviews and commits.
- **Tests** for the affected slice. A change isn't done with failing or missing tests.
- **No hardcoded business values** — thresholds, percentages, fees, toggles go in
  config. Report what you made configurable and where.
- **New packages need approval.** Stack packages are free to use.

## Workflow

1. Unclear requirements → `/grill-me` before writing anything
2. Complex or multi-step → plan first, confirm, then implement.
   Small and obvious → announce what you'll do, then do it
3. `/ponytail` — the laziest solution that actually works
4. Write the code
5. Review per `code-review.md`
6. Update the one doc this change made wrong
7. Hand off, don't commit

## Do not

- <Wrong-stack skills for this project — name them so they're never loaded.>
- Copy helpers across features. Shared code goes in `<shared dir>`.

## Conventions

- Commits: Conventional Commits (`feat:` `fix:` `docs:` `chore:` `refactor:` `test:`)
- Branch: `main`

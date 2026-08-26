# Collaboration

How work is handed over. Loaded for handoffs and scope decisions.

---

## Never commit

When an implementation is complete, **stop and report**. Nuno reviews and commits.

## Handoff format

1. **What I did and why** — short summary, tied to the story ID
2. **Files changed** — grouped (backend / frontend / tests / config)
3. **How to test** — exact commands to run
4. **Step-by-step guide** — how to reach and try the new feature/fix in the app
5. **Suggested commit message** — `US-XX.YY: <story title>` or Conventional Commits
6. **What I made configurable and where** — DB config table / settings file

---

## Scope

- Improvements **inside** the task's files: just do them (Boy Scout, scoped)
- Improvements **outside** the task's scope: **propose, don't do.** No surprise diffs.
- Unclear scope or acceptance criteria, *and* the answer would change the code →
  **ask**. Never invent.
- Unknowns about the product → log them, never invent. Add to the project's
  pending-questions file with a new ID.

---

## Conventions

- **Commits:** Conventional Commits — `feat:` `fix:` `docs:` `chore:` `refactor:` `test:`
- **ADRs** for architecture decisions
- **README** covers how to run, test, deploy
- Small PRs; review with a security + performance checklist

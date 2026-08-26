# Workflow

Session lifecycle. Slash commands, MCPs and named reviewers live in the
tool adapter, not here.

Load at the start of any coding task.

---

## Before coding

- Gather context for the area you're touching. Skip unrelated docs and files.
- Unclear goal or acceptance criteria, *and* the answer would change the work →
  **ask**. Never invent.
- Unknowns get resolved during planning, not mid-implementation.

---

## Planning

Every plan covers three things: **code, tests, documentation**. A plan missing
any of them is incomplete.

- Complex or multi-step → plan first, confirm, then implement
- Small and obvious → announce what you'll do, then do it

---

## Testing

Every implementation ships with tests covering it. A change isn't done with
failing or missing tests.

Run **only the affected suites**. If you can't tell which ones the change
hits, ask — never default to a full run.

---

## Documentation

Update docs in the same change as the code. Docs must reflect the current
state of the project.

- Record decisions and the reasoning behind them, not just what changed
- Reference existing docs rather than restating them

---

## After coding

Security review **and** code review before calling the work done — format in
`code-review.md`. Report findings. Don't silently fix things outside the
scope of the change.

Then hand off per `collaboration.md`. Don't commit.

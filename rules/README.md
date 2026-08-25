# Rules

Stack-agnostic rules. These apply to every project regardless of language or framework.
Anything stack-specific belongs in a skill (`../skills/`), not here.

| File | Holds | Load when |
|---|---|---|
| [communication-style.md](./communication-style.md) | How to write chat, commits, PRs, docs | Every response |
| [engineering-principles.md](./engineering-principles.md) | SOLID/KISS/YAGNI/DRY, the ladder before writing code, root-cause fixes, configurability | Start of any coding task |
| [code-review.md](./code-review.md) | Review process, findings table, severity scale | Running or reviewing a code review |
| [collaboration.md](./collaboration.md) | Handoff format, scope boundaries, commit conventions | Handoff, scope decisions |
| [graphify.md](./graphify.md) | Knowledge-graph navigation — **gated on `graphify-out/` existing** | Opt-in per project |

**Rule for the rules:** one concern per file, small enough to link from anywhere
without dragging the rest along. If a file grows past that, split it.

These are the deduplicated versions of rules previously copy-pasted into
`travel-buddy/docs/rules/` and `inspire-fitness-studio-web/docs/references/`.
Edit here; the presets symlink to these files.

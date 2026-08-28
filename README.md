# personal-ai-settings

Nuno's AI coding setup, centralized. Skills, agents, rules and project presets in one
place, so a new machine is one clone and a new project is one command.

**This repo is the source of truth.** `install.sh` symlinks it into `~/.claude` —
editing a file here changes the live setup, and git sees every change.

---

## Layout

```
rules/          tool-agnostic kernel — communication, principles, workflow, review, handoff
claude/         Claude Code adapter extras shared across presets (model policy)
cursor/         Cursor adapter extras shared across presets (pointer today)
copilot/        Copilot adapter extras shared across presets (pointer today)
skills/         skills I wrote or own outright (dotnet-master, neon-postgres)
agents/         subagents I wrote (DocsExplorer)
config/         reference copies of settings.json / settings.local.json
third-party/    manifest of everything installed from upstream — not vendored
presets/        drop-in bundles per stack (native files per tool)
AGENTS.md       kernel condensation (Agents.md spec). Tool extras live in adapters.
.githooks/      versioned git hooks (cspell gate on staged Markdown)
install.sh      wire this repo into ~/.claude
use.sh          drop a preset into a project
```

**Vendored vs referenced.** Only what I authored lives here in full. The 14 third-party
skills and 20 plugins are recorded in `third-party/manifest.json` with their upstream
repos and reinstalled by `install.sh` — no stale forks to maintain.

---

## New machine

```sh
git clone <this repo> ~/Projects/personal-ai-settings
cd ~/Projects/personal-ai-settings
./install.sh
```

Symlinks `skills/` and `agents/` into `~/.claude`, restores the skill lock, points
`core.hooksPath` at `.githooks`, and git-clones the third-party skills from the
manifest. Idempotent; backs up anything real it would replace. `settings.json` is left
alone — see `config/README.md`.

The hook spellchecks staged Markdown with cspell and blocks the commit on an unknown
word. It uses `npx` when cspell is not installed, and skips itself when neither is
available.

## New project

```sh
./use.sh                                  # list presets
./use.sh dotnet-react ~/Projects/newapp   # drop it in
```

Copies `CLAUDE.md`, `AGENTS.md`, `.claude/`, `.cursor/` and
`.github/copilot-instructions.md` into the target as **real files** — symlinks
are dereferenced, so the project is self-contained and safe to commit. Then fill
in the `<PLACEHOLDERS>` it prints. Refuses if those paths already exist
(`.github/` itself is left alone; only the Copilot file is checked).

| Preset         | For                                       |
| -------------- | ----------------------------------------- |
| `base`         | Any stack. Rules only.                    |
| `dotnet-api`   | Backend-only .NET 10 / Clean Architecture |
| `dotnet-react` | .NET 10 API + React 19 / Vite monorepo    |
| `nextjs-web`   | Next.js App Router + Tailwind/shadcn      |

Presets stay DRY by symlinking into `rules/`, `claude/`, `cursor/`, `copilot/`
and `skills/`. Edit the file once, every preset follows.

---

## Existing projects

`use.sh` is for empty targets. Projects that already have `CLAUDE.md` / `AGENTS.md`
were never installed that way — do not re-run it there (it would refuse, or you
would have to move local edits aside).

When you name a repo, update **additively**:

1. Leave `CLAUDE.md` and `AGENTS.md` alone. Do not overwrite local edits.
2. Copy any missing kernel file (`rules/workflow.md`, and `claude/model-policy.md`
   if the project uses Claude) into the docs tree that project already uses
   (`docs/rules/`, `docs/references/`, …).
3. Add one pointer in the docs hub / `CLAUDE.md` so the new file is loaded.
   Do not paste the file’s contents.
4. If the project already has its own workflow doc, keep it. Point at the kernel
   file for the shared bits; leave local differences (e.g. who commits) in place.
5. Cursor / Copilot adapters: copy `.cursor/rules/adapter.mdc` and
   `.github/copilot-instructions.md` the same way, only if those paths are free.

---

## Keeping it current

| Change                                       | Do                                                                |
| -------------------------------------------- | ----------------------------------------------------------------- |
| Edit a rule or skill                         | Just edit it here — `~/.claude` is symlinked, `git diff` shows it |
| Install/remove a third-party skill or plugin | `python3 third-party/refresh-manifest.py`, commit the diff        |
| Change settings.json                         | Copy it into `config/` by hand and note why in `config/README.md` |

---

## Conventions

- Rules are stack-agnostic and tool-agnostic; stack standards live in skills;
  tool extras live in the adapter (`claude/`, `cursor/`, `copilot/` — never in
  `rules/` or `AGENTS.md`). Never state the same rule twice.
- One concern per rule file.
- `dotnet-master/SKILL.md` is the single source of truth for .NET standards.
- Technical writing in English; user-facing copy in European Portuguese.

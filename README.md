# personal-ai-settings

Nuno's AI coding setup, centralized. Skills, agents, rules and project presets in one
place, so a new machine is one clone and a new project is one command.

**This repo is the source of truth.** `install.sh` symlinks it into `~/.claude` —
editing a file here changes the live setup, and git sees every change.

---

## Layout

```
rules/          tool-agnostic kernel — communication, principles, workflow, review, handoff
skills/         skills I wrote or own outright (dotnet-master, neon-postgres)
agents/         subagents I wrote (DocsExplorer)
config/         reference copies of settings.json / settings.local.json
third-party/    manifest of everything installed from upstream — not vendored
presets/        drop-in .claude/ bundles per stack (Claude adapter)
AGENTS.md       kernel condensation (Agents.md spec). Tool extras live in adapters.
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

Symlinks `skills/` and `agents/` into `~/.claude`, restores the skill lock, and
git-clones the third-party skills from the manifest. Idempotent; backs up anything real
it would replace. `settings.json` is left alone — see `config/README.md`.

## New project

```sh
./use.sh                                  # list presets
./use.sh dotnet-react ~/Projects/newapp   # drop it in
```

Copies `CLAUDE.md`, `AGENTS.md` and `.claude/` into the target as **real files** —
symlinks are dereferenced, so the project is self-contained and safe to commit. Then
fill in the `<PLACEHOLDERS>` it prints.

| Preset         | For                                       |
| -------------- | ----------------------------------------- |
| `base`         | Any stack. Rules only.                    |
| `dotnet-api`   | Backend-only .NET 10 / Clean Architecture |
| `dotnet-react` | .NET 10 API + React 19 / Vite monorepo    |
| `nextjs-web`   | Next.js App Router + Tailwind/shadcn      |

Presets stay DRY by symlinking into `rules/` and `skills/`. Edit the rule once, every
preset follows.

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
  tool extras (slash commands, MCPs, named reviewers) live in the adapter.
  Never state the same rule twice.
- One concern per rule file.
- `dotnet-master/SKILL.md` is the single source of truth for .NET standards.
- Technical writing in English; user-facing copy in European Portuguese.

# Templates

Thin per-tool adapters. Each one only points to the project's root `AGENTS.md`, which holds the shared rules. Copy them into a project after `AGENTS.md` exists (see [`../prompts/`](../prompts/README.md)).

| Adapter | Copy to | Tool |
|---|---|---|
| `CLAUDE.md` | `<project>/CLAUDE.md` | Claude Code |
| `.cursor/rules/adapter.mdc` | `<project>/.cursor/rules/adapter.mdc` | Cursor |
| `.github/copilot-instructions.md` | `<project>/.github/copilot-instructions.md` | GitHub Copilot |

Codex and OpenCode read `AGENTS.md` directly. No adapter needed.

## Single source

The Cursor and Copilot files here are **symlinks** to [`../cursor/adapter.mdc`](../cursor/adapter.mdc) and [`../copilot/copilot-instructions.md`](../copilot/copilot-instructions.md). The presets use the same sources, so `use.sh` and these templates never drift. Edit the source, not the symlink. `CLAUDE.md` is a real file here.

Use `cp -L` so the copy is a real file, not a broken link in the project.

## Copy commands

Run from this repo's root. Set `PROJECT` to the target project's path.

```bash
PROJECT="/path/to/project"
```

Claude Code:

```bash
cp templates/CLAUDE.md "$PROJECT/CLAUDE.md"
```

Cursor:

```bash
mkdir -p "$PROJECT/.cursor/rules"
cp -L templates/.cursor/rules/adapter.mdc "$PROJECT/.cursor/rules/adapter.mdc"
```

Copilot:

```bash
mkdir -p "$PROJECT/.github"
cp -L templates/.github/copilot-instructions.md "$PROJECT/.github/copilot-instructions.md"
```

All three:

```bash
mkdir -p "$PROJECT/.cursor/rules" "$PROJECT/.github"
cp templates/CLAUDE.md "$PROJECT/CLAUDE.md"
cp -L templates/.cursor/rules/adapter.mdc "$PROJECT/.cursor/rules/adapter.mdc"
cp -L templates/.github/copilot-instructions.md "$PROJECT/.github/copilot-instructions.md"
```

## Existing projects

`cp` overwrites without asking. If the project already has any of these files, don't copy over them. Use `cp -n` (never overwrite), or merge by hand and keep the project's existing rules. `ongoing-project.md` handles this case: it audits existing rules first.

## Rules

1. Keep adapters thin. Shared rules go in `AGENTS.md` only.
2. Tool-only extras go in the adapter, never in `AGENTS.md`.
3. Don't commit from here. Review the copied files in the target project first.

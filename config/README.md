# Config

Reference copies of the Claude Code settings. **`install.sh` never overwrites these**
onto a machine — they hold absolute paths and live plugin state, so merge by hand:

```sh
diff config/settings.json ~/.claude/settings.json
```

## settings.json

| Key | What it does |
|---|---|
| `model` | Default model |
| `hooks.PreToolUse` (Bash) | On a grep/find/rg command, if `graphify-out/graph.json` exists, injects a reminder to read the graph report first. No-op without a graph. |
| `statusLine` | ponytail status line — path points into the plugin cache, **machine-specific** |
| `enabledPlugins` | 20 enabled, 2 disabled (`superpowers`, `supabase`) |
| `extraKnownMarketplaces` | `ui-ux-pro-max-skill`, `ponytail`, `i-have-adhd` |
| `effortLevel` | Default reasoning effort |

## settings.local.json

Impeccable's design detector: immediate checks after `Edit`/`Write`/`MultiEdit` on UI
files, full deep pass on `Stop`. Both hooks are guarded by a `[ -f … ]` test, so they
no-op when impeccable isn't installed. Also allows the four Notion MCP read tools.

## Machine-specific values

Anything under `/Users/nunoaraujo/` will not port to another machine:

- `statusLine.command` — ponytail plugin cache path
- `settings.local.json` hook commands — impeccable script path

Both degrade gracefully (the impeccable hooks test for the file first; the status line
just fails to render), so a fresh machine works before you fix them.

# .NET Master — Claude Code plugin

A self-contained Claude Code **plugin** for .NET / C# work. One folder bundles everything:

- the **skill** that holds all the standards,
- **five subagents** that each own a stage of the workflow,
- **deterministic hooks** that enforce the standards on every edit,
- the **`scaffold-feature`** skill that runs the whole pipeline.

It loads in place as a **skills-directory plugin** (no marketplace, no install step): the folder
lives under `~/.claude/skills/` and is promoted to a plugin by its `.claude-plugin/plugin.json`
manifest.

## Namespacing — what you type

Because everything is bundled in a plugin, all components are addressed under the
`dotnet-master:` namespace:

| Component | How you reference it |
|---|---|
| Skills | `dotnet-master:dotnet-master` (standards) · `dotnet-master:scaffold-feature` (pipeline) — auto-load by description too |
| Agents | `@agent-dotnet-master:dotnet-architect` (and the other four) |

## Design principle — one source of truth

All coding standards (stack, versions, C# style, naming, async, EF Core, error handling,
logging, security defaults, anti-patterns) live in **one place**: the `dotnet-master` skill.

The agents do **not** repeat those standards. Each agent preloads the skill via its
frontmatter and adds only its own role-specific workflow:

```yaml
skills:
  - dotnet-master:dotnet-master
```

> **Why:** standards used to be copy-pasted across six files and had already drifted
> (Moq vs not, `ct` vs `cancellationToken`, package-name typos). With one source, a change
> like "drop Moq" happens once and every agent picks it up. Edit standards in the skill —
> never in an agent file.

## The pipeline

```
        ┌─────────────┐
        │  architect  │  plans first — writes PLAN.md + contracts, no code
        └──────┬──────┘
               │ PLAN.md
        ┌──────▼──────┐
        │ implementer │  reads PLAN.md, writes the production code
        └──────┬──────┘
               │ code
        ┌──────▼──────┐
        │   tester    │  writes unit + integration tests (can run in parallel)
        └──────┬──────┘
               │ tests
   ┌───────────┴───────────┐
   ▼                       ▼
┌──────────┐         ┌──────────┐
│ reviewer │         │ security │   two READ-ONLY gates before merge
└──────────┘         └──────────┘
```

| Agent | Role | Access | Output |
|---|---|---|---|
| `dotnet-architect` | Designs structure, picks architecture, defines contracts | Read + Write (plans/contracts only) | `PLAN.md` |
| `dotnet-implementer` | Turns the plan into production code | Full read/write/bash | code |
| `dotnet-tester` | Unit + integration tests (xUnit v3, Testcontainers, Shouldly) | Full read/write/bash | tests |
| `dotnet-reviewer` | Correctness/perf/standards review | **Read-only** | `REVIEW.md` |
| `dotnet-security` | Deep OWASP/JWT/secrets review | **Read-only** | `SECURITY-REPORT.md` |

The reviewer defers the full standards checklist to the skill, and deep security to
`dotnet-security`, so nothing is duplicated.

Run the whole pipeline in one shot by invoking the `dotnet-master:scaffold-feature` skill (describe the feature).

## Hooks — deterministic enforcement

The skill's standards are also enforced automatically. Hooks are wired in `hooks/hooks.json`
and run the scripts in `scripts/` (paths use `${CLAUDE_PLUGIN_ROOT}`):

| Hook | Event · matcher | What it does |
|---|---|---|
| `scripts/guard.sh` | `PreToolUse` · `Bash\|Read\|Edit\|Write` | Hard-denies destructive commands (`rm -rf`, force-push to main, `DROP …`), asks before an EF migration to a prod/remote DB, denies reading/writing secret files |
| `scripts/format.sh` | `PostToolUse` · `Edit\|Write` | Auto-formats edited `.cs` files (`dotnet format`) |
| `scripts/lint-antipatterns.sh` | `PostToolUse` · `Edit\|Write` | Flags banned patterns (`.Result`, `async void`, `new HttpClient()`, generic `Exception`, sync `SaveChanges()`, …) and blocks so they get fixed |

> Hooks fire on their events whenever the plugin is **enabled** — not only when the skill is
> invoked. The format/lint scripts self-gate to `*.cs`, so they no-op elsewhere.

## Install layout

```
~/.claude/skills/dotnet-master/        ← the plugin (loads in place as dotnet-master@skills-dir)
├── .claude-plugin/
│   └── plugin.json                     # manifest — promotes this folder to a plugin
├── SKILL.md                            # the skill (→ dotnet-master:dotnet-master)
├── references/
│   └── antipatterns.md                 # full anti-patterns list (loaded on demand)
├── agents/                             # the five specialists
│   ├── dotnet-architect.md
│   ├── dotnet-implementer.md
│   ├── dotnet-tester.md
│   ├── dotnet-reviewer.md
│   └── dotnet-security.md
├── hooks/
│   └── hooks.json                      # hook wiring → scripts/ via ${CLAUDE_PLUGIN_ROOT}
├── scripts/                            # hook scripts (chmod +x)
│   ├── guard.sh
│   ├── format.sh
│   └── lint-antipatterns.sh
├── skills/
│   └── scaffold-feature/
│       └── SKILL.md                    # → dotnet-master:scaffold-feature
└── README.md
```

After changing `hooks/`, `agents/`, or `skills/`, run `/reload-plugins` (or restart Claude
Code) to pick them up. Edits to `SKILL.md` take effect immediately.

> **Note:** the old do-everything `dotnet-master` *agent* was removed — it overlapped the
> skill and the five specialists. If you still have `agents/dotnet-master.md`, delete it.

## How to invoke

- `@agent-dotnet-master:dotnet-architect <task>` — call an agent directly
- the `dotnet-master:scaffold-feature` skill — run the full pipeline
- `/agents` — manage agents and inspect which skills they preload
- `/plugin` — enable/disable the plugin and view its components
- Or let the main session delegate via the Task tool when a task matches an agent's description

## Maintaining it

- **Change a standard?** Edit `SKILL.md` only.
- **Change a workflow?** Edit the relevant `agents/*.md` file, then `/reload-plugins`.
- **Change enforcement?** Edit `scripts/*.sh` or `hooks/hooks.json`, then `/reload-plugins`.
- **Adding an agent?** Drop it in `agents/`, give it `skills: - dotnet-master:dotnet-master`,
  keep it role-specific only.
- **Validate after changes:** `claude plugin validate ~/.claude/skills/dotnet-master`.

## Smoke test (confirm agents actually load the skill)

Subagents don't inherit skills automatically — they preload them from the `skills:` frontmatter.
Verify the wiring in two steps.

**1. Config check.** Run `/agents` and confirm each agent lists `dotnet-master:dotnet-master`
under its skills. Confirm `/plugin` shows `dotnet-master` enabled with its skill, agents, hooks,
and command.

**2. Behavioral probe.** The agents no longer contain the standards, so ask an agent something
whose answer lives **only in the skill**. If it answers with the skill's specifics, the skill
loaded. Good probes:

- Ask `dotnet-implementer`: *"Set up Serilog console logging for this API."*
  - ✅ Pass: it uses the format `[{Level:u3}] {Timestamp:yyyy-MM-dd HH:mm:ss} - {Message:lj}...`
    (e.g. `[ERR] 2026-06-26 13:30:31 - message`, exception on a new line).
  - ❌ Fail: generic Serilog setup with a different/ default template.
- Ask `dotnet-tester`: *"What's the testing stack and write a sample unit test."*
  - ✅ Pass: xUnit v3 + NSubstitute + AutoFixture.AutoNSubstitute + Testcontainers + Shouldly,
    **no Moq**.
  - ❌ Fail: mentions Moq, or a generic MSTest/FluentAssertions stack.
- Ask `dotnet-architect`: *"We have a feature-heavy module — what architecture?"*
  - ✅ Pass: Vertical Slice with plain/custom handlers; WolverineFx only if messaging/mediator
    is genuinely needed.
  - ❌ Fail: recommends WolverineFx (or MediatR) by default.

Because a subagent returns only its final summary, phrase the probe so the answer shows up in
that summary (the prompts above do).

**If a probe fails:** the skill isn't being loaded. Re-check the plugin is enabled, that the
skill resolves as `dotnet-master:dotnet-master`, and that `/agents` shows the reference, then
re-run. As a fallback you can add an explicit line to the agent body ("Load and follow the
`dotnet-master:dotnet-master` skill first"), but the frontmatter field is the documented
mechanism and should be enough.

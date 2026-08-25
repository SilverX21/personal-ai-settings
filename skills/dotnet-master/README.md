# .NET Master — Claude Code plugin

A self-contained Claude Code **plugin** for .NET / C# work. One folder bundles everything:

- the **skill** that holds all the standards,
- **five subagents** that each own a stage of the workflow,
- **deterministic hooks** that enforce the standards on every edit,
- the **`scaffold-feature`** skill that runs the whole pipeline.

It loads in place as a **skills-directory plugin** (no marketplace, no install step): the folder
lives under `~/.claude/skills/` and is promoted to a plugin by its `.claude-plugin/plugin.json`
manifest.

## Scope — .NET only

This plugin operates **on** .NET projects. A .NET repo legitimately contains TypeScript,
SQL, YAML, Dockerfiles and Terraform; those are read when they explain how the .NET
project builds or deploys, and are **never** analyzed, formatted, or linted by this
plugin.

| Layer | Boundary |
|---|---|
| `SKILL.md` | Declares in-scope artifacts and the modification boundary |
| `format.sh` · `lint-antipatterns.sh` | C# source only, via `is_csharp_source()` — also excludes `bin/`, `obj/`, `node_modules/`, and generated `*.g.cs` / `*.Designer.cs` |
| `guard.sh` | **Deliberately repo-wide.** It is a safety guard, not a .NET analyzer — a leaked `.pem` is a leaked `.pem` in any language. It only blocks; it never reads, analyzes, or modifies. |
| Agents | Scan with `-prune` on directory names and `--include` on .NET globs |

Exclusions match **directory segments**, never substrings — `grep -v "bin\|obj\|Tests"`
silently drops `WebinarService.cs` and `ProtestsController.cs`.

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

| Agent | Role | Access | Model | Output |
|---|---|---|---|---|
| `dotnet-architect` | Designs structure, picks architecture, defines contracts | Read + Write (plans/contracts only) | `claude-sonnet-5` | `PLAN.md` |
| `dotnet-implementer` | Turns the plan into production code | Full read/write/bash | `claude-sonnet-5` | code |
| `dotnet-tester` | Unit + integration tests (xUnit, Testcontainers, Shouldly) | Full read/write/bash | `claude-sonnet-5` | tests |
| `dotnet-reviewer` | Correctness/perf/standards review | **Read-only** | `claude-sonnet-5` | `REVIEW.md` |
| `dotnet-security` | Deep OWASP/secrets/authz review | **Read-only** | `claude-sonnet-5` | `SECURITY-REPORT.md` |

> **Model field.** Accepts an alias (`sonnet`, `opus`, `haiku`, `fable`), a **full model
> ID** (`claude-opus-5`, `claude-sonnet-5` — same values as the `--model` flag), or
> `inherit`. Full IDs are used here so the choice is explicit and doesn't drift when an
> alias is redefined.
>
> **Approved models for this repo:** Claude Sonnet 5, Grok 4.6, GPT-5.6 Terra, GPT-5.6
> Luna. **Opus 5 and GPT-5.6 Sol are opt-in — use them only when explicitly asked.**
>
> Claude Code subagents run on Anthropic models only, so Grok and the GPT variants cannot
> be assigned here. That leaves `claude-sonnet-5` as the one approved-and-available model,
> which is why all five agents share it. Do not "upgrade" the judgment-heavy agents
> (architect, security) to Opus without asking first.

**Scoping rule for every agent:** work from the change set (`git diff --name-only`), not
the repository. Never truncate a file list with `head` — a review that silently covers 50
of 300 files but reads as complete is worse than no review.

The reviewer defers the full standards checklist to the skill, and deep security to
`dotnet-security`, so nothing is duplicated.

Run the whole pipeline in one shot by invoking the `dotnet-master:scaffold-feature` skill (describe the feature).

## Hooks — deterministic enforcement

The skill's standards are also enforced automatically. Hooks are wired in `hooks/hooks.json`
and run the scripts in `scripts/` (paths use `${CLAUDE_PLUGIN_ROOT}`):

| Hook | Event · matcher | What it does |
|---|---|---|
| `scripts/guard.sh` | `PreToolUse` · `Bash\|Read\|Edit\|Write` | Denies recursive force-deletes of root-ish paths, force-push to `main`/`master`, and destructive SQL **being executed** (not merely grepped). Asks before an EF migration against a remote/production DB. Denies reading secret-bearing files, while allowing `.env.example` and friends. |
| `scripts/format.sh` | `PostToolUse` · `Edit\|Write` | Formats the edited `.cs` file, scoped to its **owning project** rather than the whole solution, under a 60s timeout. Auto-prefers CSharpier when installed; skips entirely if the project isn't restored yet, rather than triggering a restore inside a hook. |
| `scripts/lint-antipatterns.sh` | `PostToolUse` · `Edit\|Write` | On `.csproj`/`Directory.Packages.props`: **blocks prerelease and wildcard package versions**. On `.cs`: flags banned patterns and blocks so they get fixed. Matches against a copy with comments, raw/verbatim/regular string literals stripped; exempts event-handler `async void`; flags `ConfigureAwait(false)` **only in app projects** — it is correct in a class library. |
| `scripts/_common.sh` | *(sourced, not a hook)* | Shared scope helpers: `is_csharp_source`, `owning_project`, `is_app_project`, `strip_noise`, `rule_enabled` |

### Environment switches

| Variable | Effect |
|---|---|
| `DOTNET_MASTER_FORMATTER` | `csharpier` · `none` · `dotnet-format` (default). Unset auto-prefers CSharpier when it's a global tool. |
| `DOTNET_MASTER_SKIP_RULES` | Comma list of lint rules to disable, e.g. `result,configureawait`. Use `result` in a codebase with its own `Result` type whose `.Result` member is legitimate. |

> Hooks fire on their events whenever the plugin is **enabled** — not only when the skill is
> invoked. `format.sh` and `lint-antipatterns.sh` gate on `is_csharp_source()`, so they
> no-op on every other language and on generated/build output. All three fail open: a
> missing `jq` exits 0 rather than breaking the session.

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
│   ├── _common.sh                      # shared .NET scope helpers (sourced)
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
  - ✅ Pass: picks structure from the *pressure* (vertical slices for many independent
    features), treats Separation of Concerns as the goal and the named architecture as one
    means; a mediator only for messaging/queuing/pipeline behaviors.
  - ❌ Fail: prescribes Clean Architecture or MediatR by default, or adds layers before a
    pressure exists.
- Ask `dotnet-implementer`: *"Add a 30-day expiry check to Subscription."*
  - ✅ Pass: injects `TimeProvider` and calls `GetUtcNow()`.
  - ❌ Fail: reads `DateTime.UtcNow` inline (untestable).
- Ask any agent: *"Tidy up the TypeScript in web/src while you're here."*
  - ✅ Pass: declines — out of scope, it is not a .NET artifact.
  - ❌ Fail: starts reformatting `.ts` files.

Because a subagent returns only its final summary, phrase the probe so the answer shows up in
that summary (the prompts above do).

**If a probe fails:** the skill isn't being loaded. Re-check the plugin is enabled, that the
skill resolves as `dotnet-master:dotnet-master`, and that `/agents` shows the reference, then
re-run. As a fallback you can add an explicit line to the agent body ("Load and follow the
`dotnet-master:dotnet-master` skill first"), but the frontmatter field is the documented
mechanism and should be enough.

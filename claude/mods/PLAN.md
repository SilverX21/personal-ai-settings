# Claude Code mods — build plan

Status: phases 1–5 built · Date: 2026-10-15 · Owner: Nuno

## Table of contents

1. [Context: what the session logs showed](#1-context-what-the-session-logs-showed)
2. [Decisions](#2-decisions)
3. [Shared conventions](#3-shared-conventions)
4. [Mod specs](#4-mod-specs)
   - [4.1 session-meter](#41-session-meter)
   - [4.2 test-guard](#42-test-guard)
   - [4.3 secret-shield](#43-secret-shield)
   - [4.4 azure-wi](#44-azure-wi)
   - [4.5 ship-band](#45-ship-band)
   - [4.6 ports-manager](#46-ports-manager)
   - [4.7 notifier](#47-notifier)
   - [4.8 prompt-enhancer](#48-prompt-enhancer)
5. [Build order](#5-build-order)
6. [Open questions](#6-open-questions)
7. [Out of scope](#7-out-of-scope)

---

## 1. Context: what the session logs showed

Source: `~/.claude/history.jsonl` (1,649 prompts, 10 Jul – 14 Oct 2026), 86 main sessions + 155 subagent transcripts in `~/.claude/projects/`.

| Finding | Evidence | Mod that answers it |
|---|---|---|
| Cache reads drive cost | 1.92B cache-read tokens vs 6.7M output; top 10 sessions = 52% of cache reads | session-meter |
| Manual handoffs | 24× "give me a prompt to continue", 26 pasted back, 7× "copy to clipboard"; `/handoff` used once | session-meter |
| RAM spikes / machine freezes | 41 GB and 54 GB freezes; ~10 "only run affected tests" reminders despite CLAUDE.md rule | test-guard |
| Hidden full-suite traps | `nx test web -- <path>` ignores the path and runs the whole suite; husky `pre-push` runs `nx affected -t test` | test-guard |
| Secrets pasted in prompts | an ADO PAT, vendor ingest secrets and API keys stored in plaintext in `history.jsonl` | secret-shield |
| Repeated work-item fetch | ~20× "pull US #NNNNN and its related tasks with az CLI"; 16 re-logins (`az login`, `aws sso login`) | azure-wi |
| Manual pipeline steps | 114 one-word approvals ("yes / go / commit / push and create"); ~6× "were /code-review and /security-review done?" | ship-band |
| Leftover dev processes | ~10× "kill localhost / storybook / hanging shell", "Running in another Nx process" | ports-manager |
| No visibility on background work | ~9× "is it done? / still running? / tell me when it finishes" | notifier |
| Long prompts vary in structure | Best prompts state goal + constraints + examples; others miss acceptance criteria | prompt-enhancer |

## 2. Decisions

| # | Decision |
|---|---|
| D1 | Build as Claude Code mods (function-hook plugins), one folder per mod, each independently enable/disable-able. |
| D2 | No new `/handoff` command. `/handoff` already exists: `mattpocock/skills` → `skills/productivity/handoff`, installed via `npx skills` into `~/.agents/skills/`, symlinked into `~/.claude/skills/`. session-meter wraps it. |
| D3 | Model, context % and cache timer live in one session-meter band. |
| D4 | Context warning threshold: **45%**, with a **[Prepare handoff]** button. |
| D5 | Cache TTL default **60 min** (subscription). Falls back to **5 min** in extra-usage/overage. Timer resets on every main-thread API response. |
| D6 | Cache states, 12-min bands of time left: Warm 60–48 · Lukewarm 48–36 · Mild 36–24 · Cool 24–12 · Chilly 12–0 · Cold (expired). Bands scale proportionally for a 5-min TTL. |
| D7 | test-guard **asks, never rewrites silently**. Picker: **Everything / Only affected / Only new tests** (+ built-in "Other"). The exact command is shown before it runs. |
| D8 | test-guard matches only known full-suite patterns (from real logs). Scoped commands (file path, `--filter`, `-t`, single test project) pass through untouched. |
| D9 | test-guard fails open: if it can't build a scoped command (no changed/new test files), it says so and asks again — never blocks, never guesses. |
| D10 | test-guard escape hatch: `/test-guard off` for the session. User `!` commands are never touched (they don't go through the Bash tool). |
| D11 | test-guard ships in **observe mode** for ~1 week (log only), then switches to ask mode after reviewing the log for false hits. |
| D12 | test-guard tests use the ~100 real `pnpm nx` / `vitest` / `dotnet test` commands from session logs as fixtures. |
| D13 | Work-item command named **`/azure-wi <id>`**. |
| D14 | Port manager command named **`/ports-manager`**. |
| D15 | Screenshot-path hook dropped: since 11 Sep images are pasted as `[Image #N]`, which works; old failures were ~3. |
| D16 | prompt-enhancer is opt-in and gated (≥25 words, not `/` or `!`), toggled with `/enhance on|off`. |
| D17 | Model calls inside mods use Haiku 5.5 (`claude-haiku-5-5`) — cheap and enough for rewrite/summary tasks. |
| D18 | test-guard also catches `git push` without `--no-verify` (husky `pre-push` runs `nx affected -t test`) and asks whether to continue with `git push --no-verify`. |
| D19 | AWS auth check uses whichever profile is currently authenticated (no hard-coded profile name). |
| D20 | Source of truth for the mods: `personal-ai-settings/claude/mods/<mod-name>/`, synced by `install.sh`. |
| D21 | Model and context % move from `~/.claude/statusline-command.sh` to session-meter; the status line keeps folder + branch. |
| D22 | ship-band and session-meter are two separate mods, both drawn above the prompt. |
| D23 | notifier covers only what's missing today: long-turn done, background agent done, test results. Permission/input-needed prompts stay with Claude Code's built-in notifications. |
| D24 | Cache TTL is detected, not assumed: each main-thread response's `usage.cache_creation` says which bucket the write went to (`ephemeral_1h_input_tokens` vs `ephemeral_5m_input_tokens`). Read it from the session transcript on `turn.complete`. Early warning: any `$.session.usage().rateLimits[].percentUsed >= 100` means included usage is spent, so overage (5 min) is likely. Baseline 2026-10-14: 17,348 cache writes in 3 months, all 1h, 0 in 5m. |
| D25 | Mods ship as a **folder marketplace** in this repo: `.claude-plugin/marketplace.json` at the repo root, one entry per mod with `"source": "./claude/mods/<mod>"`. `install.sh` runs `claude plugin marketplace add <repo>` and `claude plugin install <mod>@nuno-mods` per mod. A folder marketplace is read from the folder itself, so `git pull` + `/reload-plugins` updates both machines with no reinstall; each mod can be enabled/disabled per machine with `/plugin`. |
| D26 | This repo is **public** on GitHub. Mods and docs here hold no work-specific values (org URLs, project names, account IDs, hostnames). Those go in each machine's `~/.claude/settings.json` → `pluginConfigs.<mod>.options`, which is never committed. |
| D27 | prompt-enhancer takes your workflow rules from a plugin option `rules`, default empty, set per machine. The template itself holds no workflow or project text. Rejected: hard-coding the rules (a public repo would carry one person's workflow). |
| D28 | prompt-enhancer gate: mod on, text not starting with `/` or `!`, at least `minWords` words (default 25). The spec's "meta" test is dropped: it has no reliable definition, and the opt-in switch plus the length check cover the cases that matter. A `minWords` below 1 falls back to 25. |
| D29 | prompt-enhancer keeps the first question (Improve prompt / Dismiss) so the model runs only on request. The improved text is shown in the body of the second question (Send improved / Edit / Send original), cut at 2000 characters in the dialog only. Edit drops the submit and fills the full text back into the box. |
| D30 | prompt-enhancer fails open: a model error, a timeout (20 s, set on the call itself) or an empty reply sends the original prompt and shows a toast. The on/off switch is kept in `$.store`, so it lasts across sessions; it is off until `/enhance on`. |

## 3. Shared conventions

**Folder layout (per mod)**

```
<mod-name>/
  .claude-plugin/plugin.json      { "name", "version": "0.1.0", "description", "types"? }
  hooks/hooks.json                { "modules": ["./register.tsx"] }
  hooks/register.tsx              export const register: Register = (on, options) => { ... }   (.ts when the mod draws nothing)
  types/index.d.ts                only if the mod keeps values in $.state
  test/*.test.ts                  at least one behaviour test
```

**Where they live**
- Development (hot reload): `~/.claude/dev-mods/<session-id>/<mod-name>/` was removed on 2026-10-15 (only empty session folders remained). Work in the source folder below.
- Source of truth (D20): `personal-ai-settings/claude/mods/<mod-name>/`, so `install.sh` can sync them to the company PC.

**Every mod, before "done"**
1. `claude plugin validate <mod folder>` — clean.
2. `tsc -p <mod folder>` — clean.
3. `claude plugin test <mod folder>` — green.
4. Manual check in a live session.

**Rules**
- No shared library between mods; each mod is self-contained (small duplication beats coupling).
- Per-session values in `$.state`, cross-session values in `$.store`. A `$.store` key needs no declaration: `$.store.get(key)` takes any string and returns `unknown`, so the mod casts or checks the value where it reads it. `types/index.d.ts` is only for `$.state` (`PluginState`).
- Long-running shell work through `$.process.run` / `$.process.spawn`; never block a hook on a slow command without a timeout.
- Config via plugin `userConfig` options, with sane defaults (org URL, thresholds, TTL).
- Any destructive action (kill process, redact, rewrite command) is shown to the user first.

**API surface used** (verified in this build's `claude-code.d.ts`)
`on('tool.call')`, `on('prompt.submit')` (can add `context`), `on('turn.complete')`, `on('session.start')`, `on('command.run')`, `on('ui.render')` for `AbovePrompt` / `Pane`, `$.ui.ask`, `$.ui.toast`, `$.ui.notify`, `$.ui.status`, `$.ui.copy`, `$.ui.open`, `$.session.usage()` (`context.percent`, `context.tokens`, `context.window`, `cost.usd`), `$.session.model()`, `$.model.complete`, `$.process.run`, `$.clock.now/every/sleep`, `$.store.get/set`, `$.command.register`, `prompt.fill`.

---

## 4. Mod specs

### 4.1 session-meter

**Goal:** see model, context fill and cache warmth at a glance; hand off before a session gets expensive.

**UI — band above the prompt**

```
Opus 5.5 · ctx 38% ▓▓▓▓░░░░░░ · cache Mild 31m
```

At ≥45%:

```
Opus 5.5 · ctx 47% ▓▓▓▓▓░░░░░ · cache Warm 55m   ⚠ time to hand off  [Prepare handoff]
```

**Behavior**
- **Model:** `$.session.model()`, refreshed on `session.start`, `turn.complete` and each tick.
- **Context %:** `$.session.usage().context.percent`. Colors: <30 normal · 30–44 yellow · ≥45 amber + button + one toast per session · ≥60 red.
- **Cache timer:**
  - `lastCacheTouch` = time of the last main-thread API response (`turn.step` / `turn.complete`); subagent calls don't count.
  - `remaining = TTL − (now − lastCacheTouch)`; state from D6.
  - Tick with `$.clock.every(60_000)` so it counts down while idle.
  - When **Cold** and context ≥40%: show "next message rewrites ~N tokens — consider a handoff" (N = `context.tokens`).
- **[Prepare handoff] button:**
  1. Submits `/handoff <purpose>` (purpose = current branch + active WI if known), adding context: save to `$TMPDIR/claude-handoff-<session-id>.md`.
  2. On that turn's `turn.complete`, reads the file and `$.ui.copy`s it; toast "Handoff copied".
  3. Stores the text in `$.store` under one fixed key, `handoff`, with the time, the id of the session that made it, and the flags `isCleared` and `isUsed`. The key does not include the folder, because a `/clear` can start the new session in another one.
  4. A mod gets no `source` on `session.start`, and no `session.start` fires after `/clear`. The only sign of a clear is `session.end` with reason `clear`. That hook marks the stored handoff `isCleared`, and only when the ending session is the one that made it.
  5. On the next refresh in the new session (`session.start`, a tick or `turn.complete`), if the handoff is marked, unused, from another session and under 30 minutes old, and the prompt box is empty, it fills the box (`prompt.fill`) and toasts "Handoff pre-filled: press Enter to continue." It then sets `isUsed`, so the fill happens once.
  - Limit: the store has one slot. A second handoff replaces the first, so two projects running in parallel can cross over.

**Config (`userConfig`):** `yellowPercent` (30), `warnPercent` (45), `redPercent` (60), `coldTipPercent` (40). A bad value falls back to its default. The TTL is not an option: it is detected, with `/session-meter ttl` as the manual override.

**Edge cases**
- Overage detection (D24): bucket of the last cache write decides the TTL; `rateLimits` ≥100% shows "overage likely" before the first 5m write appears. Manual override `/session-meter ttl 5|60` stays as a fallback.
- Model switched mid-session with `/model`: next tick shows it.
- `-p` / SDK runs: band not drawn; nothing breaks.

**Tests:** state mapping for 60 and 5 min TTL (boundaries 48/36/24/12/0); threshold crossing fires the toast once; the handoff refills once, only after a `/clear` of the session that made it, and also when the new session starts in a different folder.

**Acceptance:** band visible in every session; countdown moves while idle; 45% shows the button; button → clipboard has the handoff; after `/clear` the prompt is pre-filled.

**Status line (D21):** remove model + context bar from `statusline-command.sh` (keep folder + branch) once the band works.

---

### 4.2 test-guard

**Goal:** no more full-suite runs by accident; you choose the scope every time.

**Caught patterns** (from real logs + repo scripts; everything else passes through)

| Pattern | Why |
|---|---|
| `pnpm test`, `pnpm (run )?test:(all\|web\|api\|libs)` | repo scripts that run whole projects |
| `nx test <project>` with no args **or** with `-- <path>` | path filter is ignored → whole suite |
| `nx run-many … (-t\|--target[= ])test` | multi-project |
| `nx affected (-t\|--target[= ])test` | can still be large |
| `vitest run` with flags only (no file / no `related`) | whole web suite |
| `dotnet test` bare, or on `*.sln` / `*.slnx` without `--filter` | whole solution |
| `playwright test` with no spec file | whole e2e suite |

**`git push` (D18):** a `git push` without `--no-verify` triggers the husky `pre-push` hook, which runs `nx affected -t test`. test-guard asks `Pre-push hook will run affected tests. Continue with git push --no-verify?` with options **Yes, push with --no-verify** / **No, run the pre-push tests**. Only in repos that have `.husky/pre-push` with a test step.

**Passes through:** any `--filter`, `-t "<name>"`, explicit test file paths, a single `*.csproj` / `tests/<Project>` dir, `vitest related`.

**Picker** (`$.ui.ask`, question shows the caught command)

| Option | Web (Vitest) | .NET |
|---|---|---|
| **Everything** | `cd apps/web && CI=true pnpm exec vitest run --maxWorkers=1 --no-file-parallelism --no-coverage` in background | original command, in background |
| **Only affected** | changed files vs `origin/main` + uncommitted → `vitest related <files> --run --maxWorkers=1 --no-file-parallelism --no-coverage` | changed `src/<Proj>` → `tests/<Proj>.Tests` + changed test projects → `dotnet test <each project>` |
| **Only new tests** | added `*.test.ts(x)` on branch + untracked → `vitest run <files> …` | added `*Tests.cs` → class names → `dotnet test <proj> --filter "FullyQualifiedName~A\|FullyQualifiedName~B"` |
| *Other* | runs what you type | runs what you type |

- The chosen command is shown in a toast and `$.ui.log` before running.
- Background runs: rewrite `run_in_background: true`; notifier reports the result.

**Modes:** `observe` (default, week 1: log "would have caught X", run unchanged) → `ask` → `off`. Commands: `/test-guard observe|ask|off|log`.

**Fail-open rules**
- No changed/new test files → toast "nothing affected/new found", ask again without that option.
- Parse error → let the original through and log it.
- Nobody to ask (`-p`, subagent with no UI) → deny with a message explaining how to scope.

**Tests:** fixture file with the ~100 real commands from logs, each labelled `caught` / `pass`; mapping tests for changed-file → command; fail-open cases.

**Acceptance:** zero false hits on the fixture set; full-suite command shows picker; each option runs the expected command.

---

### 4.3 secret-shield

**Goal:** secrets never reach a prompt or a tracked file.

**Detection** (`prompt.submit`, and `tool.call` on `Write` / `Edit`)
- Azure DevOps PAT (52-char legacy, 84-char new format)
- JWT `eyJ…\.…\.…`
- AWS `AKIA[0-9A-Z]{16}` + secret key shape
- Header values: `(x-api-key|ada-key|x-ingest-secret|authorization|ocp-apim-subscription-key)\s*[:=]\s*\S{16,}`
- `Password=` / `pwd=` in connection strings
- Generic high-entropy strings ≥32 chars (Shannon entropy > 4)

**Allow-list (false-positive guards):** GUIDs, 40/64-hex commit SHAs, 16-hex device EUIs, `[Image #N]`, URLs without query secrets.

**On hit:** `$.ui.ask("Possible secret (<kind>) found. What now?", ["Redact & send", "Send anyway", "Cancel"])`. Redact → `<REDACTED:kind>`. For `Write`/`Edit` into a non-gitignored file: same picker; Cancel denies the tool call.

**One-off cleanup (separate step, confirm first):** back up, then scrub matches from `~/.claude/history.jsonl` and `~/.claude/projects/**/*.jsonl` with the same detector. Show the hit list before changing anything.

**Tests:** each pattern positive + allow-list negatives (GUID, SHA, EUI); redaction output.

**Acceptance:** pasting a fake PAT triggers the picker; GUID / EUI / SHA never do.

---

### 4.4 azure-wi

**Goal:** `/azure-wi 12345` replaces "pull the US and its tasks with az CLI".

**Flow**
1. `command.run` → `$.process.run(['az','boards','work-item','show','--id',id,'--expand','relations','-o','json','--org',ORG])`.
2. Child IDs from `System.LinkTypes.Hierarchy-Forward` relations → fetch each.
3. Build a compact summary: type, title, state, assignee, iteration, description and acceptance criteria (HTML stripped), task list (id · title · state · assignee).
4. Show the summary; add it as `context` to the next prompt; fill the input with "Plan US #12345." for you to edit/send.
5. Store the active WI in `$.store` (keyed by repo + branch) → status line `WI #12345 · <branch>`.

**Auth check on `session.start`** (only in repos configured to use it)
- `az account get-access-token --query expiresOn` → toast "Azure login expired — run `! az login`".
- AWS (D19): use `$AWS_PROFILE` if set, else check each profile from `aws configure list-profiles` with `aws sts get-caller-identity --profile <p>` (2 s timeout each) and use the first one that answers. None authenticated → toast "AWS SSO expired — run `! aws sso login --profile <p>`" naming the last-used profile.

**Config:** `org` and `project` (no defaults; set locally in `pluginConfigs`, never committed), `repos` (paths where checks run).

**Errors:** 401/403 → toast with the exact login command; unknown id → "not found"; `az` missing → explain once.

**Tests:** relation parsing, HTML stripping, summary format (fixture JSON from a real `az` response with secrets removed).

**Acceptance:** one command produces the US + tasks summary in under 10 s; expired login gives the right fix command.

---

### 4.5 ship-band

**Goal:** always know which delivery step you're on; one click to the next.

**UI — band above the prompt**

```
#12345 feat/xyz  WI ✓ Plan ✓ Impl ✓ Tests ✓ Review ● Security ○ Docs ○ Commit ○ PR ○ Merged ○   [Next: /code-review]
```

**Step detection** (state per `repo:branch` in `$.store`)

| Step | Marked done when |
|---|---|
| WI | `/azure-wi` used, or the branch names the item: a 5-digit id (Azure DevOps) or a leading/`#` number (GitHub issues). Hidden when the repo's source is "none" |
| Plan | `ExitPlanMode`, `Skill plan`, or a write to `docs/plans/*.md` |
| Impl | `Edit` / `Write` on source files |
| Tests | a test command exits 0 |
| Review | `Skill code-review` completes |
| Security | `Skill security-review` completes |
| Docs | `Skill document-feature` completes |
| Commit | `git commit` exits 0 |
| PR | `az repos pr create` succeeds. `Skill prepare-pr` only records that the PR is prepared (not a band step), so Next moves on to "push and create the PR" |
| Merged | "Mark merged" button, or `az repos pr show` status `completed` |

**Honesty rule:** an `Edit` / `Write` after Review or Security marks them **stale** (●→⟳) until re-run. Only those two can go stale: a skill that started earlier in the same turn and was edited over ends stale if it is Review or Security, and done otherwise (Plan, Docs and prepare-pr are not invalidated by code edits).

**[Next] button:** fills the prompt with the current step's canonical text (`/code-review`, `/security-review`, `/document-feature`, `commit`, `/prepare-pr`, then `push and create the PR` once `/prepare-pr` has run). WI, Plan, Impl and Tests have texts too. A "Mark merged" button appears once the PR is open.

**Work-item source (added 2026-10-14):** asked once per repo (Azure DevOps, GitHub issues, nowhere) and kept in `$.store`, not in `userConfig`, because it differs per repo. Until answered the band behaves as Azure DevOps. `/ship-band source [azure|github|none]` changes it; `/ship-band` prints the line; `reset`, `off` and `on` also work. PR and merge detection use `az repos` only, so with GitHub the PR step is closed by hand for now.

**Tests:** step transitions from a recorded event sequence; stale-after-edit; per-branch isolation.

**Acceptance:** "were reviews done?" answerable at a glance; Next fills the right prompt.

---

### 4.6 ports-manager

**Goal:** see and stop leftover dev servers without asking Claude.

**`/ports-manager` opens a pane**

| Port | Label | Process | PID | Project (cwd) | Up | |
|---|---|---|---|---|---|---|
| 5173 | Vite | node | 81234 | my-app | 2h | [Kill] |
| 6006 | Storybook | node | 81300 | my-app | 15m | [Kill] |

- Source: `lsof -nP -iTCP -sTCP:LISTEN`, `ps -o etime=`, `lsof -p <pid> -d cwd`.
- Labels: 5173 Vite · 6006 Storybook · 4200 Nx/Angular · 5000/5001 API · 5341 Seq · Nx daemon.
- Shows only dev processes (node, dotnet, pnpm, nx, python, java); "Show all" toggle for the rest.
- **Never lists or kills:** macOS AirPlay (ControlCenter on 5000/7000), Docker Desktop, system processes.
- [Kill] → SIGTERM, then SIGKILL after 3 s if still alive. [Kill all dev] → confirm with `$.ui.ask` first.
- Auto-refresh every 5 s while open; [Refresh] button.

**Tests:** `lsof` output parsing (fixture), filter rules (AirPlay excluded).

**Acceptance:** stale Vite/Storybook/Nx processes visible and can be killed in one click.

---

### 4.7 notifier

**Goal:** stop asking "is it done?".

- `turn.complete` and the turn took ≥ `minSeconds` (120) → `$.ui.notify("Done: <first line of answer>")`.
- Background task / subagent finished → the engine's own one-line summary, e.g. `Agent "Spec review" finished` or `Background command "make" completed`. It comes from the task notification (the next prompt's `task-notification` origin), so foreground subagents, which never send one, stay quiet, and so do subagent and aborted turns.
- A completed background **shell** task whose output has test counts → `"Tests: 42 passed, 3 failed"`. Any background shell task is looked at, not only test-guard's: nothing ties a task to test-guard. Vitest, Jest and `dotnet test` summaries are read, every summary in the output is added up, and color codes are ignored. Agents' output (a transcript), failed or killed tasks, and unknown tasks only get the summary line.
- Respects your notification settings: `$.ui.notify` uses your `preferredNotifChannel`, and a banner that is not shown (off, no channel) is not an error and shows nothing else.
- Banner text (the answer's first line, a task summary) has escape codes, control characters and line breaks removed and is cut at 160 characters, since it can end up on a lock screen.

**What exists today (checked 2026-10-14)**
- `~/.config/iterm2/cc-status` → symlink to iTerm2's bundled `cc-status` binary. It only sets the iTerm2 session status badge (`working` / `waiting` / `stopped`) via `it2`; it sends no notifications.
- Claude Code built-ins: `inputNeededNotifEnabled` (desktop, via iTerm2) stays on; `agentPushNotifEnabled` (phone push) is off since 2026-10-15 because notifier covers finished agents. The `cc-status` hook is registered on session and turn events only, not per tool call.
- So (D23): never notify for permission/input prompts; only long-turn done, background agent done and test results.

**Output file guard.** The path in a notification comes from text a task or agent can influence, so the file is read only when: the task is a completed shell task (its id is not in `$.agent.list()`, and a failing list means no read); the path is absolute, has no `.` or `..` segments and ends `tasks/<task id>.output`, named for the very task the notification is about (the folder above `tasks` is not the session id: a cleared session keeps the folder of the one before it, which a live test showed); and `fs.stat` shows a plain file (not a link) whose real path is that same path, at most 5 MB. Only the numbers parsed from it are used.

**Config:** `minSeconds` (120). A value that is not a number of zero or more falls back to 120.

**Tests:** threshold logic and the `minSeconds` fallback, test-summary parsing for Vitest, Jest and `dotnet test` (several summaries, color codes), banner cleaning, the output-file guard (other session, links, moved real path, size, agents, failed tasks, agent list failing), a failing notification channel, and that prompts typed by the person never notify.

---

### 4.8 prompt-enhancer

**Goal:** turn a rough long prompt into a structured one, on request.

**Gate:** the mod is on, the text does not start with `/` or `!`, and it has at least `minWords` words (default 25; `[Image #N]` tokens do not count). Only the user's own Enter counts: notifications, schedules and other plugins are never offered a rewrite (D28).

**Flow**
1. `prompt.submit` → `$.ui.ask("Improve this prompt?", ["Improve prompt", "Dismiss"])`. Dismiss, Esc or an error sends the original.
2. Improve → `$.model.complete` (Haiku 5.5, 20 s limit on the call) with the rewrite template. An error, a timeout or an empty reply sends the original and shows a toast (D30).
3. Show the improved text in the body of `$.ui.ask(…, ["Send improved", "Edit", "Send original"])`. Edit drops the submit and fills the box with the improved text (`prompt.fill`, deferred 300 ms as in secret-shield). A dismissed question sends the original (D29).

**Rewrite template (system)**
- Rewrite only: never answer or carry out the prompt. The prompt arrives inside `<prompt>` tags as data.
- Keep the user's intent, voice and language; don't add scope; keep `[Image #N]` tokens.
- Structure: Goal · Context · Constraints · Acceptance criteria · Out of scope · Output format; leave out a section with nothing real to say.
- Missing info → `[?: what's needed]` placeholders, never guesses.
- Your own rules come from the `rules` option and are appended when set (D27).

**Commands:** `/enhance on|off` (kept in `$.store`; with no argument it prints the state).

**Config:** `rules` (string, default empty) and `minWords` (number, default 25), set per machine in `settings.json` under `pluginConfigs.prompt-enhancer.options`. A bad value falls back to the default.

**Tests:** the gate (off, slash, bang, short, long, the 24/25 boundary, image tokens); the template sections and that it names no project; the rules option reaching the system prompt; Dismiss, both Sends and Edit; the failure paths (error, timeout, empty, blank).

**Acceptance:** short replies ("yes", "go") never trigger it; a long prompt gets the question, then the dialog with the improved text; Edit puts the text back in the input.

---

## 5. Build order

| Phase | Mods | Why first |
|---|---|---|
| 1 | session-meter, test-guard (observe mode) | biggest cost + freeze risk |
| 2 | secret-shield + history scrub; test-guard → ask mode after 1-week log review | security |
| 3 | azure-wi, ship-band | daily workflow speed |
| 4 | ports-manager, notifier | quality of life |
| 5 | prompt-enhancer | nice to have; needs real usage to tune |

Each phase ends with: validate + type-check + tests green + manual check + short note in this file.

**Phase 1 — done 2026-10-14.** session-meter (8 tests) and test-guard in observe mode (5 tests, 142 real-command fixtures) validated, type-checked, checked live. Installed from this repo as `<mod>@nuno-mods` (folder marketplace, D25); model + context removed from `~/.claude/statusline-command.sh` (D21). Still to see live: the handoff button and the refill after `/clear`. test-guard ask mode is due after a week of `/test-guard log` review (≈ 2026-10-21).

**Phase 2 — secret-shield done 2026-10-14.** secret-shield (12 tests) validated, type-checked, loaded live: asks Redact & send / Send anyway / Cancel on prompts with a secret, and Redact & write / Write anyway / Cancel on `Write`/`Edit` of a secret into a git-tracked file; fails open. High-entropy detection runs on typed text only. No per-project config: any field named like a secret (`*key`, `*secret`, `*token`, `*password`, `*pwd`, `*credential(s)`, `*auth(orization)`, `sig`/`*signature`) in a header, JSON/YAML, env var or URL parameter is checked; its value must look like a credential (letters + digits, not a GUID, name, placeholder, code, path, URL or date). Tuned on the local logs: 423 hits → 31, all real or fixture keys. History scrub (`scripts/scrub.mjs`, dry run by default) redacted 64 hits of 16 values in 17 files; 0 left on re-run; backups deleted. Test fixtures are fake values. Still to do: scrub this session's transcript once it is closed, rotate any key still live, test-guard ask mode (≈ 2026-10-21).

**Phase 3 — ship-band built 2026-10-14** (azure-wi is work-specific, so it lives in `~/.claude/local-mods` on the company PC and is not in this repo). 16 tests, validated, type-checked, and fixed after a review (per-session values live in `$.state`; only Review and Security go stale; the saved-branch cap no longer evicts the branch in use; the PR step now asks for the push after `/prepare-pr`). Where the work items live is asked once per repo (Azure DevOps, GitHub issues, or nowhere) and kept in `$.store`: it decides how a branch name gives the item id, what the WI step's Next button says, and whether the WI step is shown; `/ship-band source [azure|github|none]` changes it. Steps per `repo:branch` in `$.store`. A skill counts as done when the turn that ran it ends normally, or stale if a source edit came after it in that turn. `/ship-band` prints the line; `reset`, `off` and `on` also work. Detection of tests is a command pattern plus a non-error result. Not yet seen live: the band itself and the Next button.

**Phase 4 — ports-manager built 2026-10-14** (notifier below). 29 tests (made-up `lsof`/`ps` fixtures, one live parse check on the real machine), validated, type-checked; each safety check was broken in turn to confirm a test fails without it. `/ports-manager` opens a pane of dev listeners with label, project (cwd), uptime and [Kill]; [Show all], [Refresh] and [Kill all dev] (asks first). With Show all on, a single [Kill] asks first too, since that list holds databases and editors; with it off, a dev row is killed without a question on purpose (one click, as the spec says). A question that is dismissed or fails counts as no. Kill is SIGTERM, then SIGKILL after 3 s. A target is the process as shown (pid, command, port): it is only signalled while a fresh listing still shows the same three, checked before the SIGTERM and again before the SIGKILL (a process that closed its port or changed hands in between is left alone, and the toast says so). Never listed or killed, even with Show all: AirPlay/ControlCenter, Docker, macOS daemons, other users' processes, and this session's own process and ancestors (found from the `ps` row of the mod's own call). It fails closed: if the user or the own chain cannot be determined, nothing is listed or signalled. Every `kill` has a timeout, and failures are reported rather than counted as stopped. One 5 s tick for the session refreshes only while the pane is open. No config. Known limits: a hung server that has closed its port is not SIGKILLed; the real Nx daemon listens on a unix socket and usually runs as `node`, so it does not show up in a TCP listing and would need a match on process arguments. Not yet seen live: the pane drawing and the buttons. Dev processes are matched by whole name (node, dotnet, pnpm, npm, yarn, nx, java, python and `python3.x`). The Nx daemon label is by name only (a process literally named `nx`), so it rarely applies; port 4200 is always Nx/Angular.

**Phase 4 — notifier built 2026-10-14**, then fixed after a review. 24 tests (invented Vitest, Jest and `dotnet test` summaries), validated, type-checked; each guard was broken in turn to confirm a test fails without it. Three triggers only (D23: never for permission or input prompts): a main-loop turn that ends normally after at least `minSeconds` (default 120) says `Done: <first line of the answer>`; a background agent or shell finishing says its own summary line; and a completed background shell task whose output has test counts says `Tests: 42 passed, 3 failed`. The details and the output-file guard are in section 4.7. Known limits: only the first task notification in a prompt is read; error turns do not notify; the wording of an agent's banner is the engine's summary, not literally `Agent <name> finished`. The notification text was checked live against a real one: tags `<task-id>`, `<tool-use-id>`, `<output-file>`, `<status>`, `<summary>` in that order, the first match of each tag winning. Not yet seen: that the `task-notification` prompt fires while the session is idle (otherwise banners arrive with the next prompt), and the native banner itself.

**Phase 5 — prompt-enhancer built 2026-10-15.** 29 tests (a made-up rules text, mocked model reply), validated; each guard was broken in turn to confirm a test fails without it (the empty-section line of the template needed one more assertion, added). The API was read from this build's type file: `$.model.complete` takes `{ model, system, prompt, timeoutMs }` and resolves `{ isAnswered, text }` or a `reason`, so the 20 s limit is the call's own, with no timer race. The switch is in `$.store`. Known limits: code blocks count as words and CJK text is counted too low; the hook order against secret-shield was checked live on 2026-10-15: secret-shield asked first and the rewrite request carried only `<REDACTED:…>` placeholders, so a secret in a prompt does not reach the model. Not yet seen live: the two dialogs with a long improved text (cut at 2000 characters in the dialog), Edit refilling a long text, a multi-line `rules` value from `settings.json`, and the `tsc --noEmit` check (it needs the types the engine writes on the first load).

**Hardening review — 2026-10-15.** A read-only review of the whole Claude Code setup, then fixes. Done: an unused MCP server removed and the other pinned to an exact version; a disabled plugin uninstalled and its cache, the old cached plugin versions, the old `settings.json` backups and the empty `dev-mods` folders deleted; an `az devops` auto-allow narrowed to `work-item show`; the secret-shield / prompt-enhancer order verified live (above). Checked, no action: `cc-status` (section 4.7) is the iTerm2-bundled binary, signed by the iTerm2 author and notarized. Limit found: a marketplace `ref` takes a branch or tag, not a commit SHA, so a third-party plugin cannot be pinned to the commit that was reviewed. Those plugins stay unpinned: review their `SessionStart` hooks before any `claude plugin update`. Skills: the available count went from 141 to about 95 by setting unused ones to `"off"` in `skillOverrides` (`settings.local.json`; reversible, symlinks stay): unused cloud, infrastructure-as-code, image and database skills, duplicate account copies of local skills, 7 overlapping design-style skills, 2 image-build skills, and 3 agent-orchestration / refactor skills. `skillOverrides` does not apply to plugin skills, so a plugin's duplicate names cannot be hidden that way. Voice plugins start off and are switched on per session. Notifications consolidated: the built-in `agentPushNotifEnabled` is off (notifier already reports finished background agents and tasks), and the `cc-status` hook no longer runs on `PreToolUse` / `PostToolUse` (one process spawn per tool call saved; the iTerm2 badge now updates on the other events only). Kept: `inputNeededNotifEnabled`, the status line, session-meter and ship-band (no overlap). Still to do: rotate any key still live, test-guard ask mode (≈ 2026-10-21).

## 6. Open questions

Q1–Q8 answered on 2026-10-14 → decisions D18–D26. No open questions.


## 7. Out of scope

- Screenshot path hook (D15).
- Pruning unused skills/agents (separate cleanup task; reduces per-request context).
- Any change to project repos (work repos) — mods only touch `~/.claude` and this repo.

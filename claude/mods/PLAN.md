# Claude Code mods — build plan

Status: two mods, session-meter and prompt-upgrade · Updated: 2026-10-21 · Owner: Nuno

## Table of contents

1. [Context: what the session logs showed](#1-context-what-the-session-logs-showed)
2. [Decisions](#2-decisions)
3. [Shared conventions](#3-shared-conventions)
4. [Mod spec: session-meter](#4-mod-spec-session-meter)
5. [Mod spec: prompt-upgrade](#5-mod-spec-prompt-upgrade)
6. [Retired mods](#6-retired-mods)
7. [Out of scope](#7-out-of-scope)

---

## 1. Context: what the session logs showed

Source: `~/.claude/history.jsonl` (1,649 prompts, 10 Jul – 14 Oct 2026), 86 main sessions + 155 subagent transcripts in `~/.claude/projects/`. The findings that still have a mod:

| Finding | Evidence | Mod that answers it |
|---|---|---|
| Cache reads drive cost | 1.92B cache-read tokens vs 6.7M output; top 10 sessions = 52% of cache reads | session-meter |
| Manual handoffs | 24× "give me a prompt to continue", 26 pasted back, 7× "copy to clipboard"; `/handoff` used once | session-meter |

The other findings (RAM spikes, secrets in prompts, repeated work-item fetches, manual pipeline steps, leftover dev processes, background-work visibility, prompt structure) were answered by mods that have since been retired: see section 5.

## 2. Decisions

| # | Decision |
|---|---|
| D1 | Build as Claude Code mods (function-hook plugins), one folder per mod, each independently enable/disable-able. |
| D2 | No new `/handoff` command. `/handoff` already exists: `mattpocock/skills` → `skills/productivity/handoff`, installed via `npx skills` into `~/.agents/skills/`, symlinked into `~/.claude/skills/`. session-meter wraps it. |
| D3 | Model, context % and cache timer live in one session-meter band. |
| D4 | Context warning threshold: **45%**, with a **[Prepare handoff]** button. |
| D5 | Cache TTL default **60 min** (subscription). Falls back to **5 min** in extra-usage/overage. Timer resets on every main-thread API response. |
| D6 | Cache states, 12-min bands of time left: Warm 60–48 · Lukewarm 48–36 · Mild 36–24 · Cool 24–12 · Chilly 12–0 · Cold (expired). Bands scale proportionally for a 5-min TTL. |
| D20 | Source of truth for the mods: `personal-ai-settings/claude/mods/<mod-name>/`, synced by `install.sh`. |
| D21 | Model and context % move from `~/.claude/statusline-command.sh` to session-meter; the status line keeps folder + branch. |
| D24 | Cache TTL is detected, not assumed: each main-thread response's `usage.cache_creation` says which bucket the write went to (`ephemeral_1h_input_tokens` vs `ephemeral_5m_input_tokens`). Read it from the session transcript on `turn.complete`. Early warning: any `$.session.usage().rateLimits[].percentUsed >= 100` means included usage is spent, so overage (5 min) is likely. Baseline 2026-10-14: 17,348 cache writes in 3 months, all 1h, 0 in 5m. |
| D25 | Mods ship as a **folder marketplace** in this repo: `.claude-plugin/marketplace.json` at the repo root, one entry per mod with `"source": "./claude/mods/<mod>"`. `install.sh` runs `claude plugin marketplace add <repo>` and `claude plugin install <mod>@nuno-mods` per mod. A folder marketplace is read from the folder itself, so `git pull` + `/reload-plugins` updates both machines with no reinstall; each mod can be enabled/disabled per machine with `/plugin`. |
| D26 | This repo is **public** on GitHub. Mods and docs here hold no work-specific values (org URLs, project names, account IDs, hostnames). Those go in each machine's `~/.claude/settings.json` → `pluginConfigs.<mod>.options`, which is never committed. |

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
2. `tsc -p <mod folder>` — clean (in a scratch copy with the engine's types laid out at `.claude-plugin/types/claude-code/index.d.ts`: the engine writes them only when it loads a mod from its source folder, so `tsc -p` in the repo fails with TS5083).
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
## 4. Mod spec: session-meter

**Goal:** see model, context fill and cache warmth at a glance; hand off before a session gets expensive.

**UI — band above the prompt**

```
Opus 5.5 · ctx 38% ▓▓▓▓░░░░░░ · cache Mild 31m
```

At ≥45% the figure is amber and a button appears:

```
Opus 5.5 · ctx 47% ▓▓▓▓▓░░░░░ · cache Warm 55m [Prepare handoff]
```

**Behavior**
- **Model:** `$.session.model()`, refreshed on `session.start`, `turn.complete` and each tick.
- **Context %:** `$.session.usage().context.percent`. Colors: <30 normal · 30–44 yellow · ≥45 amber + button + one toast per session (no extra text or bold) · ≥60 red.
- **Cache timer:**
  - `lastCacheTouch` = time of the last main-thread API response (`turn.step` / `turn.complete`); subagent calls don't count.
  - `remaining = TTL − (now − lastCacheTouch)`; state from D6.
  - Tick with `$.clock.every(15_000)` so it counts down while idle.
  - When **Cold** and context ≥40%: show "next message rewrites ~N tokens — consider a handoff" (N = `context.tokens`).
- **[Prepare handoff] button:**
  1. Submits `/handoff <purpose>` (purpose = current branch), adding context: save to `$TMPDIR/claude-handoff-<session-id>.md`.
  2. On that turn's `turn.complete`, reads the file and `$.ui.copy`s it; toast "Handoff copied".
  3. Stores the text in `$.store` under one fixed key, `handoff`, with the time, the id of the session that made it, and the flags `isCleared` and `isUsed`. The key does not include the folder, because a `/clear` can start the new session in another one.
  4. A mod gets no `source` on `session.start`, and no `session.start` fires after `/clear`. The only sign of a clear is `session.end` with reason `clear`. That hook marks the stored handoff `isCleared`, and only when the ending session is the one that made it.
  5. On the next refresh in the new session (`session.start`, a tick or `turn.complete`), if the handoff is marked, unused, from another session and under 30 minutes old, and the prompt box is empty, it fills the box (`prompt.fill`) and toasts "Handoff pre-filled: press Enter to continue." It then sets `isUsed`, so the fill happens once.
  6. The "handoff copied" line in the band clears when the next main-thread turn starts.
  - Limit: the store has one slot. A second handoff replaces the first, so two projects running in parallel can cross over.

**Config (`userConfig`):** `yellowPercent` (30), `warnPercent` (45), `redPercent` (60), `coldTipPercent` (40). A bad value falls back to its default. The three context thresholds must satisfy yellow ≤ warn ≤ red; if not, all three fall back to 30/45/60. The TTL is not an option: it is detected, with `/session-meter ttl` as the manual override.

**Edge cases**
- Overage detection (D24): bucket of the last cache write decides the TTL; `rateLimits` ≥100% shows "overage likely" before the first 5m write appears. Manual override `/session-meter ttl 5|60` stays as a fallback.
- Model switched mid-session with `/model`: next tick shows it.
- `-p` / SDK runs: band not drawn; nothing breaks.

**Tests:** state mapping for 60 and 5 min TTL (boundaries 48/36/24/12/0); threshold crossing fires the toast once; the "copied" line clears on the next turn; threshold order is validated; the handoff refills once, only after a `/clear` of the session that made it, and also when the new session starts in a different folder.

**Acceptance:** band visible in every session; countdown moves while idle; 45% shows the button; button → clipboard has the handoff; after `/clear` the prompt is pre-filled.

**Status line (D21):** remove model + context bar from `statusline-command.sh` (keep folder + branch) once the band works.

Known and not done: the dependency on an external `/handoff` command (D2).

---

## 5. Mod spec: prompt-upgrade

**Goal:** turn a rough prompt into a complete one before it is sent: up to three multiple-choice questions, a rewrite, then a side-by-side review. Nothing is sent until **Run it**. Usage and install steps: `prompt-upgrade/README.md`.

| # | Decision |
|---|---|
| D31 | `/better <prompt>` upgrades one prompt; `/better on`/`off` switches automatic mode (off by default), which sends typed prompts to the pane first. Slash commands, attachments, prompts typed while a turn runs, replies of three words or fewer, and a leading `>` (stripped) pass through. |
| D32 | Only prompts the person typed (origin `composer`) are intercepted, so the mod's own `$.prompt.submit` on **Run it** cannot loop back. |
| D33 | Questions use `haiku`, the rewrite `sonnet`: two model calls per upgrade. The rewrite never invents facts; unknowns stay as `[placeholders]`. |
| D34 | The flow lives in `$.state` (survives a reload, and the interrupted model call is re-run); history (last 20) and the switch live in `$.store`. Cancel, or closing the pane, puts the original back in the prompt box. |
| D35 | Ships with its own `install.sh`, which re-points a `nuno-mods` marketplace that reads from another folder before installing. |

It does what the retired prompt-enhancer (section 6) did, but in a pane, with questions, and only on request or in automatic mode.

Known and not done: no live check yet of the pane's look on the terminal and desktop surfaces.

---

## 6. Retired mods

On 2026-10-21 six mods were removed from this repo and uninstalled: test-guard, secret-shield, ship-band, ports-manager, notifier and prompt-enhancer. A seventh, azure-wi, lived outside this repo and was deleted with it. Their specs, decisions (D7–D16, D18, D19, D22, D23, D27–D30; D17 went with prompt-enhancer) and phase notes were dropped from this file. The code stays in git history: `git log --diff-filter=D --name-only -- claude/mods` finds the commit that removed each one (they are all present in `f3e046a~1`).

Unfixed audit items left behind with them: secret-shield did not cover secrets written through Bash; test-guard had no "ask" mode (it only observed); azure-wi did not handle concurrent calls.

## 7. Out of scope

- Screenshot path hook: pasted images work as `[Image #N]`.
- Pruning unused skills/agents (separate cleanup task).
- Any change to project repos: mods only touch `~/.claude` and this repo.

# agent-dock

Pick a **Team Size**, and every request is split across exactly that many helper agents running in parallel. A pane shows each helper as a card with a face, a task name, a timer and a meter.

```
◆  A G E N T   D O C K                                   ● L I V E
──────────────────────────────────────────────────────────────────
T E A M  S I Z E   ╭ 1  3  5  10 [20] 50  100 │ Custom ╮
Splits each request across 20 helpers  ·  20 at a time  ·  Fast & Cheap

M I S S I O N   Research bakery pricing                 45%   1:12
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
● 12 working    ○ 8 queued    ✓ 30 done    ✕ 0 stuck
```

It is a mod of its own and works with or without Clean View.

## Install

This is a Claude Code mod (a function-hook plugin) in this repo's folder marketplace, `nuno-mods`. From a shell:

```
claude plugin install agent-dock@nuno-mods --scope user
```

From a terminal session's prompt, once this folder is pushed to GitHub:

```
/plugin install agent-dock --marketplace SilverX21/personal-ai-settings
```

After you install or edit the mod, run `/reload-plugins` or start a new session.

## Use it

| Control | What it does |
|---|---|
| `/dock` | Opens the pane, or folds it to a status-bar badge ("12 working · 8 queued · 30 done") |
| `/dock 10` | Sets the Team Size to 10 and opens the pane |
| **◆ Dock** button | At the right of the band above the prompt; opens or folds the pane |
| Size chips, **Custom** | Pick 1, 3, 5, 10, 20, 50 or 100, or type any whole number from 1 to 100 |
| **Helper agents** | Fast & Cheap (Haiku) or Same as me |

A size above 20 asks first ("Big team: this uses your plan quickly"), and it never carries over to the next session: it resets to 1. At size 1 the dock adds nothing to your request, so Claude decides on its own and skills that launch agents work as before.

## How it works

- **Split.** Above size 1, each request carries a hidden note telling Claude to split it into exactly N pieces and launch one helper per piece in one message.
- **Cap and nudge.** Agent calls past N for one request are refused. A request that ends having used fewer than N gets one follow-up asking for the rest, once.
- **Queue.** Claude Code refuses an Agent call past `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` instead of queueing it, so the dock holds extra calls until a slot frees. It waits with a one-second host `sleep`, which does not spend the hook's 10-second budget (`$.clock.sleep` would). "At a time" is the lower of that limit and `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY`; set both to 20 in your user settings' `env` for waves of 20. Pressing Esc while a call waits refuses it with "Stopped before this helper started."
- **Cards.** A card shows as queued as soon as Claude writes the Agent call, turns working when it starts, and done or stuck when it returns. Each helper calls the dock's own tool, `mcp__agent-dock__report_progress`, to move its meter. More than 12 helpers draw as small tiles.
- **Model.** Fast & Cheap sends helpers to Haiku when Team Size is above 1 and the call named no model.
- **Status line.** The dock writes the working count to `~/.claude/ai-employee-kit-data/agents-now/<session_id>.json`, which a status line can show as "◇ N agents".

## Faces

`employee-headshots/` holds 36 original pixel mascots (12 colors × 3 looks), drawn by `tools/make_mascots.py` with only the Python standard library. Change the colors there and rerun it:

```
python3 -I claude/mods/agent-dock/tools/make_mascots.py
```

The pictures show only in terminals that draw images (kitty, Ghostty). Everywhere else, the desktop app included, each card wears a colored two-letter badge.

## Limits

- A big team spends your plan fast: 50 helpers means about 50 agent runs per request.
- The idle seats change as the pane redraws, not on a timer: the dock runs no clock while idle.
- Claude Code's status line has no room for a button, so the **◆ Dock** button sits in the band above the prompt. With another mod drawing that band, the button shows only when the dock's hook runs on top of it; `/dock` always works.

## Development

```
claude plugin validate claude/mods/agent-dock
claude plugin test claude/mods/agent-dock
```

Everything in the dock that needs no `$` lives in `hooks/dock-logic.ts`, so tests can call it directly; every `$` call stays in `hooks/dock.tsx`.

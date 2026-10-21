# clean-view

Makes Claude Code feel calm and friendly for people who aren't technical. While Claude works, one simple checklist sits above the prompt: the plan, what is happening now and how far along it is.

```
Build my landing page · 1m 12s                     [ ● Clean View: ON ]
✓ Read your brand notes            ██████████  Done
▶ Build the pricing section        ██████░░░░  60%
○ Add the contact form             ░░░░░░░░░░  Next
○ Polish the footer                ░░░░░░░░░░  Up next
```

## Install

This is a Claude Code mod (a function-hook plugin). It lives in the folder marketplace `nuno-mods` in this repo.

From a terminal session's prompt, once this folder is pushed to GitHub:

```
/plugin install clean-view --marketplace SilverX21/personal-ai-settings
```

From a local clone of this repo, run the install script. It adds the `nuno-mods` marketplace from the clone (or re-points one that reads from another folder), removes a standalone `clean-view@clean-view-mods` copy if there is one, and installs the mod at user scope:

```
./claude/mods/clean-view/install.sh
```

The script uses full paths, so it runs from any folder, the root directory included:

```
"/Users/<you>/Docs do Nuno/personal-ai-settings/claude/mods/clean-view/install.sh"
```

The repo's own `install.sh` also installs every mod listed in `.claude-plugin/marketplace.json`, this one included.

In the desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `SilverX21/personal-ai-settings` (or the clone's path), then **Add plugin**.

After you install or edit the mod, run `/reload-plugins` or start a new session.

## Use it

| Control | What it does |
|---|---|
| **Clean View: ON / OFF** button | One click shows or hides the checklist, with a short toast |
| `/simple` | Switches it either way |
| `/simple on` | Shows the checklist |
| `/simple off` | Hides the checklist; only the button stays |

Clean View starts on, and your choice is remembered after a restart.

## What the checklist shows

- **Header:** the job's name in 2 to 6 plain words, then how long it has been running.
- **Done steps:** a green check, a dimmed name, a full meter and "Done".
- **Current step:** a ▶, the name in bold and a meter at the reported percent. With no percent yet, the meter sweeps and the label says "Working".
- **Upcoming steps:** dimmed. The first says "Next", the rest "Up next".

The header changes with the job:

| State | Header shows |
|---|---|
| Working | Job name · time running |
| Needs you | A **Needs you** badge and the reason; the current step's ▶ becomes ‖ |
| Stuck | ⚠ Stuck: the reason, in one plain sentence |
| Stopped | ■ Stopped · job name · you pressed Esc |
| Done | ✓ All done · job name · took 2m 14s, shrinking to one line after 5 seconds |

## How it works

- Claude gets two tools: `plan_steps` lays out 2 to 8 steps up front, and `report_progress` moves the meter. A step reported at 100 is checked off and the next one starts.
- While Clean View is on, a system-prompt section tells Claude to plan first, in plain words with no file names, commands or code.
- Until a plan exists, the main agent's other tools are refused with a note to call `plan_steps` first. ToolSearch, TodoWrite, TaskCreate, TaskUpdate and AskUserQuestion always pass; subagents are never held.
- To-do lists (TodoWrite, TaskCreate, TaskUpdate) become checklist rows. Permission prompts and questions switch the header to **Needs you**; a "no" to a permission, three failed tool calls in a row, an API error or a refusal switch it to **Stuck**.
- Every name passes through one cleaner: backtick code, anything with a slash and code file names are dropped, and names are cut to 40 characters at a word.

## Cost and limits

- Each new job makes one small `haiku` call, at low effort, to name the job. It must be allowed on your account; without it the header reads "Working on your request".
- The plan-first rule applies to every request while Clean View is on, quick questions included.
- If Claude ends a reply before checking off every planned step, the header reads **Needs you** with "Claude is waiting for your reply".
- The band is drawn on the terminal and desktop surfaces.

## Agent Dock

The second mod in this plugin. Pick a **Team Size** and every request is split across exactly that many helper agents running in parallel. A pane shows each helper as a card, with a face, a task name, a timer and a meter.

```
◆  A G E N T   D O C K                                   ● L I V E
──────────────────────────────────────────────────────────────────
T E A M  S I Z E   ╭ 1  3  5  10 [20] 50  100 │ Custom ╮
Splits each request across 20 helpers  ·  20 at a time  ·  Fast & Cheap

M I S S I O N   Research bakery pricing                 45%   1:12
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
● 12 working    ○ 8 queued    ✓ 30 done    ✕ 0 stuck
```

### Use it

| Control | What it does |
|---|---|
| `/dock` | Opens the pane, or folds it to a status-bar badge ("12 working · 8 queued · 30 done") |
| `/dock 10` | Sets the Team Size to 10 and opens the pane |
| **◆ Dock** button | Beside the Clean View button above the prompt; opens or folds the pane |
| Size chips, **Custom** | Pick 1, 3, 5, 10, 20, 50, 100, or type any whole number from 1 to 100 |
| **Helper agents** | Fast & Cheap (Haiku) or Same as me |

A size above 20 asks first ("Big team: this uses your plan quickly"), and it never carries into the next session: it resets to 1. At size 1 the dock adds nothing to your request, so Claude decides on its own and skills that launch agents work as before.

### How it works

- **Split.** Above size 1, each request carries a hidden note telling Claude to split it into exactly N pieces and launch one helper per piece in one message.
- **Cap and nudge.** Agent calls past N for one request are refused. A request that ends having used fewer than N gets one follow-up asking for the rest, once.
- **Queue.** Claude Code refuses an Agent call past `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` instead of queueing it, so the dock holds extra calls until a slot frees. It waits with a one-second host `sleep`, which does not spend the hook's 10-second budget (`$.clock.sleep` would). "At a time" is the lower of that limit and `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY`; both are set to 20 in user settings. Esc while a call waits refuses it with "Stopped before this helper started."
- **Cards.** A card appears queued as soon as Claude writes the Agent call, turns working when it starts, and done or stuck when it returns. Helpers call `report_progress`, which the dock catches before Clean View, to move their own meter. More than 12 helpers draw as small tiles.
- **Model.** Fast & Cheap sends helpers to Haiku when Team Size is above 1 and the call named no model.
- **Status line.** The dock writes the working count to `~/.claude/ai-employee-kit-data/agents-now/<session_id>.json`, which `~/.claude/statusline-command.sh` shows as "◇ N agents".

### Faces

`employee-headshots/` holds 36 original pixel mascots (12 colors × 3 looks), drawn by `tools/make_mascots.py` with the Python standard library. Change the colors there and rerun it:

```
python3 -I claude/mods/clean-view/tools/make_mascots.py
```

The pictures show only in terminals that draw images (kitty, Ghostty). Everywhere else, the desktop app included, each card wears a colored two-letter badge.

### Limits

- A big team spends your plan fast: 50 helpers means about 50 agent runs per request.
- The idle seats change as the pane redraws, not on a timer: the dock runs no clock while idle.
- Claude Code has no button slot in its status line, so the **◆ Dock** button sits in the band above the prompt instead.

## Development

```
claude plugin validate claude/mods/clean-view
claude plugin test claude/mods/clean-view
```

All `$`-free dock logic lives in `hooks/dock-logic.ts` so tests can call it; every `$` call stays in `hooks/dock.tsx`. The dock registers before Clean View in `hooks/register.tsx`, so its helper `report_progress` hook answers first. Both mods hook several of the same events, so the dock uses catch-all matchers (`{ cwd: /^/ }`, `{ text: /^/ }`) to keep one hook per event and matcher.

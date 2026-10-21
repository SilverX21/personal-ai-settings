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

## Development

```
claude plugin validate claude/mods/clean-view
claude plugin test claude/mods/clean-view
```

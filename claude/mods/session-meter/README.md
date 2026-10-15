# session-meter

A band above the prompt that shows the model, how full the context is, and how warm the prompt cache is. When the context gets large it offers a one-click handoff, so you can start a fresh session without losing the thread.

```
Opus 5.5 · ctx 47% ▓▓▓▓▓░░░░░ · cache Warm 52m   ⚠ time to hand off [Prepare handoff]
```

## Install

This is a Claude Code mod (a function-hook plugin). It lives in a folder marketplace named `nuno-mods`:

```
/plugin install session-meter --marketplace SilverX21/personal-ai-settings
```

Claude Code asks you to set the options (below) during install. The defaults are fine to accept. To install from a local clone, add the repository folder as a marketplace and install from it.

After you edit the mod, run `/reload-plugins`.

## What the band shows

- **Model and context.** The context figure is colored by the thresholds below.
- **Cache.** One of Warm, Lukewarm, Mild, Cool, Chilly or Cold, with the minutes left. The cache time to live (TTL) is detected from the session transcript, and 60 minutes is assumed until it is.
- **Cold-cache tip.** When the cache is cold and the context is large, the band says the next message will rewrite that many tokens, so a handoff may be cheaper.
- **Handoff offer.** At the warn threshold the band shows a **Prepare handoff** button and raises one toast per session.

## Commands

| Command | What it does |
|---|---|
| `/session-meter ttl 5` | Treat the cache TTL as 5 minutes for this session |
| `/session-meter ttl 60` | Treat the cache TTL as 60 minutes for this session |
| `/session-meter ttl auto` | Go back to detecting the TTL |
| `/session-meter handoff` | Same as the **Prepare handoff** button |

## Handoff

The button (or `/session-meter handoff`) runs your `/handoff` command with the current branch and a path under `$TMPDIR`. You need a `/handoff` command or skill for this to work. When the file is written, the mod copies it to the clipboard and saves it for this folder.

Then run `/clear`. If the prompt box is empty, the handoff text fills it, and you press Enter to continue. The fill happens only:

- after a `/clear` of the session that made the handoff (a resumed or new session does not get it),
- in the same folder,
- within 30 minutes,
- once.

## Options

Set in the install screen, in `/config`, or in settings under `pluginConfigs.session-meter.options`. All four are percentages of the context window from 0 to 100. A value that is missing, not a number or out of range falls back to its default.

| Option | Default | Effect |
|---|---|---|
| `yellowPercent` | 30 | The context figure gets a color from here |
| `warnPercent` | 45 | Amber and bold, the **Prepare handoff** button, and the toast |
| `redPercent` | 60 | The context figure turns red |
| `coldTipPercent` | 40 | The cold-cache tip appears from here, when the cache is cold |

Keep `yellowPercent` below `warnPercent` and `redPercent`. The mod does not check the order.

## Limits

- The cache clock moves only when a turn finishes, not during a turn. Mid-turn the band shows "working".
- The meter reads the session transcript with a shell command to detect the TTL.

## Development

```
claude plugin validate claude/mods/session-meter
claude plugin test claude/mods/session-meter
```

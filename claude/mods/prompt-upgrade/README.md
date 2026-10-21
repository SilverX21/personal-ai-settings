# prompt-upgrade

Turns a rough prompt into a clear, complete one before it is sent. It opens a pane, asks up to three quick multiple-choice questions, rewrites the prompt, and shows your original and the upgrade side by side. Nothing is sent until you press **Run it**.

```
✓ Your prompt  ──  ✓ Questions  ──  ✓ Rewrite  ──  ● Review
[ Run it ] [ Edit ] [ Copy ] [ History ]  Cancel
```

## Install

This is a Claude Code mod (a function-hook plugin). It lives in the folder marketplace `nuno-mods` in this repo.

From a terminal session's prompt:

```
/plugin install prompt-upgrade --marketplace SilverX21/personal-ai-settings
```

From a local clone of this repo, run the install script. It adds the `nuno-mods` marketplace from the clone (or re-points one that reads from another folder) and installs the mod at user scope:

```
./claude/mods/prompt-upgrade/install.sh
```

The repo's own `install.sh` also installs every mod listed in `.claude-plugin/marketplace.json`, this one included.

In the desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `SilverX21/personal-ai-settings` (or the clone's path), then **Add plugin**.

After you install or edit the mod, run `/reload-plugins` or start a new session.

## Use it

| Command | What it does |
|---|---|
| `/better <prompt>` | Upgrade that prompt in the pane |
| `/better` | Open the pane with a box to type a prompt |
| `/better on` | Automatic mode: prompts you type go to the pane first |
| `/better off` | Prompts go straight through again |
| `/better history` | Your last 20 upgrades; pick one to reopen its review |

The pane walks four steps, shown as a tracker across the top:

1. **Your prompt.** Your words in a card while the questions are chosen.
2. **Questions.** Up to three, each with two to four option chips, **Other (type it)** and **Skip**. **Skip the rest, upgrade now** goes straight to the rewrite. If no question would help, this step is skipped.
3. **Rewrite.** The upgraded prompt and a short list of what was added.
4. **Review.** Words before, words after and details added; then **Run it**, **Edit**, **Copy**, **Cancel**; then the "what I added" list and the two prompts side by side.

**Edit** lets you change the upgraded text; Enter runs it. **Cancel**, or closing the pane, puts your original back in the prompt box. If a model call fails, an error card offers **Try again**, **Send my original** and **Cancel**.

## Automatic mode

With `/better on`, these still go straight through untouched:

- slash commands,
- prompts with files or images attached,
- messages sent while Claude is working,
- replies of three words or fewer ("yes", "keep going"),
- anything starting with `>`, which is sent without the `>`.

The prompt the mod sends on **Run it** never comes back into the pane: only prompts you type are intercepted.

## Rewrite rules

The rewrite keeps what you meant and adds a goal, the audience, the format and what "done" looks like. It uses your answers and leaves out what you skipped. It never invents facts, names, numbers or prices: unknowns stay as `[placeholders]`.

## Cost and limits

- Each upgrade makes two model calls: `haiku` for the questions, `sonnet` for the rewrite. Both must be allowed on your account.
- Automatic mode is off by default. The setting and your history live in the mod's own store, never in this folder.
- The mobile app has no text fields, so **Edit**, **Other (type it)** and the typing box are hidden there.

## Development

```
claude plugin validate claude/mods/prompt-upgrade
claude plugin test claude/mods/prompt-upgrade
```

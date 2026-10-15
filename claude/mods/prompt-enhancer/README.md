# prompt-enhancer

Rewrites a long, rough prompt into a structured one, only when you ask. Spec: PLAN.md section 4.8.

Off until you run `/enhance on` (kept across sessions). When a prompt of at least 25 words is sent, it asks "Improve this prompt?". On Improve, a small model rewrites it into Goal, Context, Constraints, Acceptance criteria, Out of scope and Output format, and you pick Send improved, Edit or Send original. Edit puts the improved text back in the input box. If the model fails or times out, your original is sent and a toast says so.

Prompts that start with `/` or `!` are never touched.

## Options

Set them per machine in `~/.claude/settings.json`; they are not stored in this repo (D26).

```json
{
  "pluginConfigs": {
    "prompt-enhancer": {
      "options": {
        "rules": "Prefer small diffs.\nAsk before anything destructive.",
        "minWords": 25
      }
    }
  }
}
```

`rules` is added to the rewrite instructions (one rule per line, at most 2000 characters). `minWords` below 1 falls back to 25.

# Model policy

Claude Code adapter. Kernel rules do not assign models.

---

Approved for agents and skills, no need to ask:

- **Claude Sonnet 5** (`claude-sonnet-5`)
- **Grok 4.6**
- **GPT-5.6 Terra**
- **GPT-5.6 Luna**

**Opt-in only — use exclusively when explicitly asked:** Opus 5, Fable 5, GPT-5.6 Sol.
Never "upgrade" an agent to one of these because a task looks hard.

Platform limit: Claude Code subagents accept only Anthropic models in their
`model:` frontmatter — an alias (`sonnet`, `opus`, `haiku`, `fable`), a full ID
(`claude-sonnet-5`), or `inherit`. Grok and the GPT variants cannot be assigned
there, so Claude Code agents default to `claude-sonnet-5`. Use full IDs, not
aliases, so the choice doesn't shift when an alias is redefined.

# Hooks

`hooks/` is an extension to the portable Agent Skills package. The Agent Skills standard does not define a universal hook schema, so these files are intentionally client-neutral.

## Intended lifecycle

### Pre-task

Before Azure operational or architecture work, apply `hooks/pre-task.md`.

Purpose:

- classify the task;
- identify production/destructive risk;
- select the right specialist role and references;
- avoid acting on guessed subscription/tenant/resource context.

### Post-task

Before finalizing Azure operational or architecture work, apply `hooks/post-task.md`.

Purpose:

- verify the solution;
- check security/cost regressions;
- include rollback/recovery guidance where needed;
- verify date-sensitive facts.

### Reference freshness

Run:

```bash
python3 hooks/reference-freshness.py
```

By default it flags reference files whose `last_reviewed` date is older than 45 days.

## Integration

If your client supports prompt or lifecycle hooks, map its pre-task/pre-tool phase to `pre-task.md` and its post-task/finalization phase to `post-task.md`.

If your client only supports executable hooks, create a thin client-specific wrapper around these files and `reference-freshness.py` rather than embedding client-specific syntax into the portable skill.

See `hooks/manifest.example.yaml` for the intended semantics. It is documentation, not a portable standard configuration file.

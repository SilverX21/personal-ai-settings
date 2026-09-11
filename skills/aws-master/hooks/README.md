# Hooks

`hooks/` is a client-neutral extension to the portable Agent Skills package. The Agent Skills standard does not define a universal hook schema, so these files describe intended lifecycle behavior that a host may wire into its own hook/event system.

## Intended lifecycle

### Pre-task

Apply `hooks/pre-task.md` before AWS operational, architecture, security, or deployment work.

Purpose:

- classify the task;
- identify production/destructive risk;
- select the right specialist role and references;
- identify language/framework only when implementation needs it;
- avoid acting on guessed account/Region/resource context.

### Post-task

Apply `hooks/post-task.md` before finalizing AWS operational, architecture, security, or deployment work.

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

By default it warns when a reference has not been reviewed for 45 days.

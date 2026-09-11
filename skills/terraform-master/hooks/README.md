# terraform-master hooks

Hooks are lightweight lifecycle checklists for the skill.

- `pre-task.md`: classify intent, specialist, references, provider, versions, backend/state, destructive risk, secrets, and freshness needs.
- `post-task.md`: correctness/safety/complexity/verification completion gate.
- `reference-freshness.py`: scans `references/**/*.md` for `last_reviewed` metadata and reports fresh/stale/missing files.
- `manifest.example.yaml`: example integration manifest for hosts that support hook registration.

The hooks do not automatically modify Terraform or reference content.

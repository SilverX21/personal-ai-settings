# graphify

**Gated: everything below applies only IF `graphify-out/` exists in the project root.**
No `graphify-out/` → this file is a no-op. Do not mention it, do not look for it,
do not suggest generating it unasked.

---

## When a graph exists

- Read `graphify-out/GRAPH_REPORT.md` before reading source files or running
  grep/glob. The graph is the primary map of the codebase.
- IF `graphify-out/wiki/index.md` exists → navigate that instead of raw files.
- Cross-module questions ("how does X relate to Y") → prefer the graph over grep,
  it traverses EXTRACTED + INFERRED edges instead of scanning files:
  ```
  graphify query "<question>"
  graphify path "<A>" "<B>"
  graphify explain "<concept>"
  ```
- After modifying code: `graphify update .` (AST-only, no API cost).

Don't dump `GRAPH_REPORT.md` wholesale into context — query it.

---

## Install

Not a vendored skill. The `graphify` CLI ships its own SKILL.md and self-updates.

```sh
which graphify || echo "install graphify first"
```

Version pinned when this repo was written: `0.7.15`

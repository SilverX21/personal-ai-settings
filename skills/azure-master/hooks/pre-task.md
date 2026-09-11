# Pre-task hook

Apply this before Azure build/change, troubleshooting, architecture, security, governance, or production work.

1. Classify the request: Learn, Build/Change, Troubleshoot, or Design/Review.
2. Select the primary specialist role from `agents/`.
3. Load only the relevant `references/` files.
4. If implementation code or framework integration is required, determine the user's/project's language and load the matching file under `references/languages/`. Do not assume a language.
5. For changing facts (pricing, limits, certification, availability, CLI syntax, retirement/preview status), load `references/sources.md` and verify official Microsoft documentation when lookup is available.
6. Identify whether the task touches production or high-impact resources.
7. Identify security, networking, data-loss, and cost implications that could materially change the solution.
8. Do not invent tenant IDs, subscription IDs, resource names, regions, topology, permissions, or current configuration.
9. Prefer read-only inspection before mutation during troubleshooting.
10. Prefer the simplest managed Azure solution that satisfies the requirement.

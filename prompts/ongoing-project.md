# Task: Create or Update AGENTS.md — Ongoing Project

## Objective

Create or update a comprehensive, maintainable, and project-specific `AGENTS.md` file at the root of an **existing** repository, **without breaking any rule, workflow, or tool configuration already in place**.

This file will serve as the **single source of truth for shared project instructions**, guiding AI coding agents such as Claude, OpenAI Codex, OpenCode, and GitHub Copilot.

The instructions must establish consistent standards for:

- Project understanding and architecture.
- Software engineering principles and best practices.
- Design patterns and architectural decisions.
- Security and privacy.
- Code quality and code review.
- Testing and regression prevention.
- Documentation maintenance.
- Communication and output style.
- Scope control and change management.
- Validation and definition of done.

The resulting instructions must be technology-agnostic at their core while accurately reflecting the actual technologies, architecture, conventions, and requirements discovered in the project.

**Do not assume anything about the project. Audit existing rules first, investigate, ask when information is missing, and only then write the file.**

**Language:** write `AGENTS.md`, questions, and reports in English.

---

## Phase 0 — Audit Existing Rules (mandatory, read-only)

Before changing anything, find and read every instruction already guiding agents in this repository. Do not edit, move, or delete any file in this phase.

### 1. Locate existing instruction sources

Search the repository root and relevant subdirectories for, at minimum:

- `AGENTS.md` (root and nested).
- `CLAUDE.md`, `.claude/` (settings, agents, skills, commands, hooks).
- `.cursor/rules/`, `.cursorrules`.
- `.github/copilot-instructions.md`, `.github/instructions/`, `.github/agents/`.
- `.codex/`, `.opencode/`, `opencode.json`.
- `CONTRIBUTING.md`, `CODEOWNERS`, PR and issue templates.
- Lint, format, and editor configs that encode conventions (`.editorconfig`, linters, formatters, spell-check).
- Git hooks and CI checks that enforce rules (`.githooks/`, Husky, pre-commit, pipelines).
- Existing docs that state rules (`docs/`, ADRs, architecture notes, security policy).

Report which of these exist and which do not.

### 2. Build a rules inventory

For each existing instruction source, extract its rules and record:

| Source | Rule (short) | Scope | Enforced by (tool/hook/CI/none) |
|---|---|---|---|

### 3. Classify the current state

Classify each rule as:

- **Keep:** reasonable, consistent with the code, must survive unchanged.
- **Conflict:** contradicts another rule, the kernel, or the actual code.
- **Outdated:** refers to files, tools, or practices that no longer exist.
- **Duplicate:** repeated across files and at risk of drifting.

### 4. Protect what exists

Rules for the rest of this task:

1. Existing rules win by default. Do not remove, weaken, or reword the meaning of a rule without explicit user approval.
2. Never overwrite an existing `AGENTS.md` or other instruction file wholesale. Merge into it and show a diff.
3. Never alter hooks, CI, settings, or tool configs as part of this task.
4. Keep tool-specific files (`CLAUDE.md`, `.cursor/rules`, Copilot instructions) working. Do not break their references to each other.
5. Preserve user-authored content and ordering where possible so diffs stay reviewable.
6. If a rule is enforced by a hook or CI, treat it as a hard constraint and mention it in the file.

### 5. Present the audit and stop

Show the user:

1. List of instruction sources found.
2. The rules inventory.
3. Classification (keep / conflict / outdated / duplicate), with evidence.
4. Proposed handling for each conflict, outdated, or duplicate rule.

Ask for approval on conflicts and removals **before** moving on. Do not proceed to writing until resolved.

---

## Phase 0.5 — Seed from the Kernel

Use the personal kernel as the base for shared sections instead of regenerating them from scratch.

1. Read the kernel: `/Users/nunoaraujo/Docs do Nuno/personal-ai-settings/AGENTS.md`. If unreachable, ask the user to paste it.
2. Compare the kernel against the Phase 0 inventory. For each kernel rule, mark it as: already present, missing, or conflicting with an existing rule.
3. Add missing kernel rules. Never replace an existing project rule with a kernel rule silently. Report conflicts and ask.
4. Use the kernel as the base for the shared sections: Communication, Engineering principles (Phase 3 sections 5, 6, 11, 12), Workflow, Handoff, Code review, and the testing/documentation expectations (Phase 3 sections 9, 10).
5. Add only project-specific content on top: overview, repository structure, documentation index, verified stack, security specifics, and project constraints.
6. Link to kernel files (e.g. `rules/*.md`) instead of copying them when they are available to the project.

---

## Phase 1 — Understand the Project

Before writing `AGENTS.md`, explore the repository to understand its purpose, structure, and implementation.

### 1. Repository reconnaissance

Inspect the available project resources, including:

- Repository structure and directory organization.
- README and existing documentation.
- Source code and application modules.
- Configuration files and environment templates.
- Dependency manifests and lockfiles.
- Build scripts and development commands.
- Tests and testing configuration.
- Database schemas, queries, and migrations.
- API definitions and integrations.
- Infrastructure and deployment configuration.
- CI/CD pipelines and automation.
- Existing instruction files, agent definitions, and reusable skills (already inventoried in Phase 0).

Do not limit the investigation to source code. Explore the relevant supporting files and assets needed to understand how the project operates.

Exclude irrelevant generated files, dependency directories, and build artifacts from routine exploration.

Use recent version-control history (commit style, branching, hot spots) as evidence of real conventions.

### 2. Understand the project's purpose

Identify:

- What the project does.
- Which problems it solves.
- Its main features and responsibilities.
- Its intended users or consumers, where identifiable.
- Its main application boundaries and modules.
- Important business rules and constraints.
- External systems and integrations.
- Important operational or security requirements.

Prefer information from existing documentation and implementation.

Do not invent business requirements or architectural decisions.

### 3. Identify the technology stack

Discover the technologies actually used by the project.

Where applicable, identify:

- Programming languages.
- Frameworks and libraries.
- Runtime and platform versions.
- Application architecture.
- Data storage and persistence.
- APIs and communication mechanisms.
- Authentication and authorization.
- Testing frameworks and tools.
- Build and package management.
- Infrastructure and deployment platforms.
- CI/CD and automation tools.

Inspect the actual manifests and configuration rather than relying exclusively on README descriptions.

Document only technologies and versions that can be verified.

### 4. Understand the architecture

Investigate how the project is organized and how its components interact.

Identify, where applicable:

- Architectural style and boundaries.
- Application entry points.
- Main modules and responsibilities.
- Important execution and data flows.
- External dependencies and integrations.
- Persistence and infrastructure boundaries.
- Shared components and common abstractions.
- Authentication and authorization boundaries.
- Background processes and scheduled operations.

Do not impose an architectural pattern simply because it is commonly used.

Describe the architecture that actually exists, including inconsistencies or areas that require further investigation.

### 5. Understand existing conventions

Identify established practices relating to:

- Naming and code organization.
- Error handling and validation.
- Logging and observability.
- Dependency management.
- Configuration and secrets.
- Testing.
- Documentation.
- Code review.
- Version control and branching.
- Build, deployment, and operational workflows.

Prefer existing conventions when they are reasonable and maintainable.

Identify problematic or inconsistent practices without automatically turning them into mandatory standards.

---

## Phase 2 — Identify Missing Information

After the audit and exploration, determine whether enough information exists to produce accurate project instructions.

### Ask questions when necessary

If essential information is missing, ambiguous, incomplete, or contradictory, ask for clarification before making assumptions.

Examples include:

- The project's actual purpose or intended users are unclear.
- Important business rules are not documented.
- Architectural decisions cannot be established from the codebase.
- Required coding or testing conventions are unknown.
- Security or authorization requirements are unclear.
- Important development or deployment workflows cannot be identified.
- Existing instructions conflict with the current implementation.

Ask only questions whose answers materially affect the quality or correctness of `AGENTS.md`.

Keep questions concise and grouped logically when several related details are missing.

Do not ask questions that can be answered through reasonable repository exploration.

### Separate findings by confidence

When presenting preliminary findings, distinguish:

- **Verified:** Directly supported by repository files, configuration, implementation, or documentation.
- **Inferred:** A reasonable conclusion based on available evidence, but not explicitly confirmed.
- **Unknown:** Information that cannot currently be established.

Never present an inference as a verified project requirement.

If the repository provides insufficient information, explain what is missing rather than filling gaps with generic assumptions.

---

## Phase 3 — Design the AGENTS.md Structure

Once the project is sufficiently understood, define a structure that provides useful instructions without becoming unnecessarily large.

If an `AGENTS.md` already exists, keep its structure and ordering where reasonable and add or adjust sections instead of reorganizing it.

Use the following sections as a starting point. Adapt them to the project's actual needs rather than including every section mechanically.

### 1. Project Overview

Describe:

- Project purpose.
- Main responsibilities.
- Important application boundaries.
- Verified technology stack.
- Relevant architectural characteristics.

Keep the description concise.

### 2. Repository Structure

Provide a practical overview of the important directories and files.

Explain what the main areas are responsible for and where developers should look when investigating or modifying functionality.

Avoid documenting every file.

### 3. Documentation Index

Identify important project documentation and explain when agents must read it.

Include, where available:

- Architecture documentation.
- Business requirements and rules.
- Feature documentation.
- API and integration documentation.
- Database documentation.
- Security requirements.
- Development and testing guides.
- Deployment and operational documentation.

Clearly identify which documents are mandatory before particular types of work.

Do not invent documentation paths. Only reference existing documents or clearly identify documented future additions.

### 4. Working Rules

Define a consistent workflow for AI agents.

Include requirements to:

- Understand the request before acting.
- Read relevant code and documentation before implementing changes.
- Investigate dependencies and affected components.
- Follow existing project conventions.
- Respect business and architectural constraints.
- Avoid assumptions and unnecessary changes.
- Validate the implementation.
- Update affected documentation.
- Communicate results and outstanding work.

### 5. Software Engineering Principles

Include the following principles:

**KISS — Keep It Simple**

Prefer straightforward, readable, and maintainable solutions.

**SOLID**

Apply relevant design principles where they improve responsibility boundaries, flexibility, or testability.

**YAGNI — You Aren't Gonna Need It**

Do not implement hypothetical requirements or unnecessary abstractions.

**SoC — Separation of Concerns**

Keep responsibilities clearly separated.

**DRY — Don't Repeat Yourself**

Avoid meaningful duplication without introducing unnecessary abstractions.

Apply these principles with judgment rather than mechanically.

Also emphasize readability, cohesion, loose coupling, maintainability, and simplicity.

### 6. Architecture and Design Patterns

Define how agents should approach architectural and design decisions.

Require agents to:

- Understand the existing architecture before proposing changes.
- Prefer established project conventions when appropriate.
- Use design patterns only when they solve a real problem.
- Consider simpler alternatives before introducing abstractions.
- Evaluate maintainability, complexity, compatibility, and trade-offs.
- Avoid overengineering and premature optimization.
- Research significant architectural decisions when necessary.

When external technical research is relevant, prioritize current, authoritative documentation and clearly reference sources that materially support the decision.

Do not prescribe a specific architecture or design pattern unless the project requirements justify it.

### 7. Security and Privacy

Establish security as an ongoing engineering responsibility.

Cover applicable practices such as:

- Least privilege.
- Authentication and authorization.
- Input validation.
- Safe handling of untrusted data.
- Secrets and credential management.
- Sensitive data protection.
- Secure communication.
- External integrations and dependencies.
- Logging and information disclosure.
- Appropriate error handling.
- Security reviews and threat awareness.

Require agents to understand existing security controls before changing security-sensitive functionality.

Never expose secrets in source code, documentation, logs, examples, or responses.

Security guidance must reflect the actual project requirements and threat model.

### 8. Code Quality and Review

Define standards for reviewing and modifying code.

Require agents to consider:

- Correctness and requirements compliance.
- Readability and maintainability.
- Separation of responsibilities.
- Error handling and validation.
- Security and privacy.
- Compatibility and regressions.
- Dependency and interface changes.
- Performance where relevant.
- Unnecessary complexity.
- Documentation consistency.

When reporting findings, identify the problem, its impact, relevant evidence, and a practical recommendation.

Distinguish confirmed defects from potential risks and stylistic preferences.

### 9. Testing and Regression Prevention

Establish testing as part of implementation.

Require agents to:

- Inspect existing testing conventions.
- Create or update relevant tests after adding features, changing behavior, refactoring, or deleting code.
- Cover important business rules, edge cases, and failure scenarios.
- Use appropriate testing levels for the functionality being changed.
- Avoid unnecessary testing dependencies.
- Never weaken or bypass existing tests merely to make them pass.
- Execute relevant validation and report actual results.
- Disclose any tests that could not be executed and why.

Use the testing tools and practices actually supported by the project.

### 10. Documentation Standards

Establish documentation as part of the development lifecycle.

Require agents to:

1. Read relevant documentation before changing implementation.
2. Identify which documentation will be affected.
3. Update documentation after implementation.
4. Keep descriptions, examples, diagrams, and instructions consistent with the final behavior.
5. Create new documentation when a meaningful feature, architectural decision, or operational workflow lacks an appropriate reference.
6. Avoid unnecessary duplication.
7. Verify documentation references and examples.

Documentation must describe what actually exists, not what was originally planned.

### 11. Comments and Maintainability

Establish that:

- Code should be self-explanatory.
- Names and responsibilities should be clear.
- Comments should be used only when they add meaningful context.
- Comments should be short and direct.
- Outdated comments should be corrected or removed.
- Documentation should not be replaced with excessive implementation comments.

### 12. Scope Control and Change Management

Require agents to:

- Make the smallest appropriate change.
- Avoid unrelated refactoring and opportunistic cleanups.
- Preserve existing behavior unless explicitly required otherwise.
- Avoid unnecessary dependencies and abstractions.
- Respect existing user changes.
- Assess destructive or externally impactful actions before executing them.
- Follow established project workflows for version control and consequential operations.
- Explain technical conflicts and recommend cleaner alternatives.

### 13. Communication and Output Style

Establish the following mandatory communication standards:

- **Be concise, but clarity beats concision.** If being short creates ambiguity, add the sentence.
- Prioritize clarity over complexity and organization over volume.
- Avoid filler, repetition, lengthy introductions, and unnecessary explanations.
- Get straight to the useful information.
- Make findings, decisions, results, and next steps immediately clear.
- Never sacrifice accuracy or meaning for brevity.
- Never invent missing information.
- Be transparent about uncertainty and incomplete work.
- Ask for clarification when essential information is missing instead of guessing.

Whenever providing sequential instructions, use a numbered, ordered list with clear, actionable steps.

Final responses should communicate what was done, relevant validation, outstanding issues, and whether further action is required.

**Default principle: Answer first, then only the words needed for clarity.**

### 14. Final Verification and Definition of Done

Establish a practical checklist for agents to use before declaring work complete.

Include, where applicable:

- Requirements satisfied.
- Relevant documentation reviewed.
- Existing conventions followed.
- Engineering principles applied appropriately.
- Security implications considered.
- Relevant tests created or updated.
- Validation executed.
- Documentation synchronized.
- No unnecessary modifications introduced.
- Final changes reviewed.
- Outstanding issues communicated.

Never describe incomplete work as complete.

---

## Phase 4 — Keep Instructions Maintainable

The resulting `AGENTS.md` must be useful without becoming an exhaustive technical manual.

Follow these guidelines:

- Prioritize rules that apply across the project.
- Avoid repeating information already maintained in specialized documentation or skills.
- Reference existing authoritative documents instead of copying their entire contents.
- Keep instructions actionable rather than theoretical.
- Avoid arbitrary rules that do not provide meaningful value.
- Do not prescribe tools, frameworks, libraries, or architectural patterns without evidence.
- Do not include obsolete or unverified information.
- Use clear headings and a logical hierarchy.
- Prefer concise explanations over lengthy essays.
- Remove redundant or contradictory instructions, only after the user approves removals of existing rules (Phase 0).

Project-specific facts and constraints should be included only when verified.

Technology-specific implementation details should remain in appropriate specialized documentation or skills, not in the shared engineering principles.

---

## Phase 5 — Multi-Agent Compatibility

This project may use multiple AI coding tools, including:

- Claude.
- OpenAI Codex.
- OpenCode.
- GitHub Copilot.

Use `AGENTS.md` as the canonical source of shared instructions.

Before creating or changing additional instruction files:

1. Use the Phase 0 inventory of instruction formats already in use.
2. Identify whether any tool requires additional compatibility configuration.
3. Keep tool-specific instructions separate from shared engineering standards.
4. Avoid copying the entire contents of `AGENTS.md` into other files.
5. Do not edit existing tool-specific files unless needed to remove a conflict or duplicate, and only with user approval.
6. Create additional compatibility files only when necessary and justified.

Do not assume that all tools interpret instruction files identically. Verify behavior where possible and clearly document any limitations.

Do not create unnecessary agent definitions, skills, hooks, or tool configurations as part of this task.

---

## Phase 6 — Create or Update AGENTS.md

After completing the audit, the investigation, and resolving essential uncertainties:

1. Create `AGENTS.md` at the repository root, or merge into the existing one. Never overwrite it wholesale.
2. Use the agreed structure, adapting it to the actual project.
3. Preserve every rule marked **Keep** in Phase 0, with its meaning intact.
4. Apply only the conflict, outdated, and duplicate resolutions the user approved.
5. Include verified project information and technology details only where useful.
6. Apply the shared engineering standards described in this prompt and the kernel.
7. Include the relevant documentation index and mandatory reading requirements.
8. Preserve important project-specific constraints, including rules enforced by hooks or CI.
9. Keep the instructions concise, actionable, and maintainable.
10. Do not create or modify unrelated files.

If essential information remains missing, ask for clarification before writing assumptions into the file.

---

## Phase 7 — Validate AGENTS.md

After writing the file:

1. Review the complete document.
2. Verify that project descriptions and technology details match repository evidence.
3. Verify all referenced files, paths, and links.
4. Check that the instructions do not contradict each other or any rule enforced by hooks or CI.
5. Confirm that shared standards are technology-agnostic.
6. Confirm that security, testing, documentation, and code review guidance are present.
7. Confirm that important project-specific requirements have not been omitted.
8. Check that the document is concise and does not duplicate existing specialized guidance.
9. Ensure no unrelated project files were changed (review the full diff).
10. Re-run the Phase 0 inventory against the result: every **Keep** rule is still present, and no rule was dropped or weakened without approval.
11. Confirm existing tool-specific files (`CLAUDE.md`, `.cursor/rules`, Copilot instructions) still resolve and agree with `AGENTS.md`.

**Never commit or push.** Stop after validation and hand off with the report below.

---

## Phase 8 — Final Response (Handoff)

Provide a concise report containing:

1. **What and why:** What was created or changed and the reason for the main choices.
2. **Files changed:** Grouped by purpose, with paths. Include `AGENTS.md` and any compatibility file.
3. **Rules audit result:** Table of existing rules with their outcome.

   | Rule | Source | Outcome (kept / merged / changed / removed) | Approved by user |
   |---|---|---|---|

4. **Project understanding:** A brief summary of the discovered project purpose, architecture, and technology stack.
5. **Instructions added:** The main standards and workflows added, and which came from the kernel.
6. **Sources used:** The project documentation and files used to derive the instructions.
7. **Validation:** Checks performed and their actual results.
8. **How to test:** Steps to verify nothing broke (e.g. start a fresh agent session per tool and confirm it follows both old and new rules; run any hooks or CI checks).
9. **Step-by-step guide:** Numbered next actions for the user, including review and commit.
10. **Suggested commit message:** Conventional Commits format (e.g. `docs: update AGENTS.md with shared engineering standards`).
11. **What became configurable:** Any project values, toggles, or settings the file now exposes or points to; "none" if nothing.
12. **Unknowns:** Any missing information, assumptions, or unresolved questions.

If essential information could not be established, explain the limitation rather than presenting an incomplete or speculative instruction file as authoritative.

**Definition of done:** A root-level `AGENTS.md` exists and reflects the project, every approved existing rule is preserved, shared engineering standards are added without conflicts, and the file can guide all supported coding agents without relying on technology-specific assumptions for its core principles. Nothing was committed.

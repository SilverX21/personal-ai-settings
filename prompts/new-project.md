# Task: Create AGENTS.md — Project Instructions from Scratch

## Objective

Create a comprehensive, maintainable, and project-specific `AGENTS.md` file at the root of the repository.

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

**Do not assume anything about the project. Investigate first, ask when information is missing, and only then create the file.**

**Language:** write `AGENTS.md`, questions, and reports in English.

---

## Phase 0 — Seed from the Kernel

Start from the personal kernel instead of regenerating shared rules from scratch.

1. Read the kernel: `/Users/nunoaraujo/Docs do Nuno/personal-ai-settings/AGENTS.md`. If unreachable, ask the user to paste it.
2. Use the kernel as the base for the shared sections: Communication, Engineering principles (Phase 3 sections 5, 6, 11, 12), Workflow, Handoff, Code review, and the testing/documentation expectations (Phase 3 sections 9, 10).
3. Add only project-specific content on top: overview, repository structure, documentation index, verified stack, security specifics, and project constraints.
4. Do not weaken or silently drop a kernel rule. If a project fact conflicts with a kernel rule, report it and ask.
5. Link to kernel files (e.g. `rules/*.md`) instead of copying them when they are available to the project.

---

## Phase 1 — Understand the Project

Before creating `AGENTS.md`, explore the repository to understand its purpose, structure, and implementation.

**Empty or near-empty repository fallback:** if there is no meaningful code, documentation, or configuration to inspect, skip the exploration below and run a short interview instead (Phase 2). Ask only what the file needs: purpose and users, intended stack and versions, architecture, testing approach, security/privacy constraints, deployment, and workflow conventions. Mark every answer as user-provided, not verified, until the repository confirms it.

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
- Existing instruction files, agent definitions, and reusable skills.

Do not limit the investigation to source code. Explore the relevant supporting files and assets needed to understand how the project operates.

Exclude irrelevant generated files, dependency directories, and build artifacts from routine exploration.

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

After exploring the repository, determine whether enough information exists to produce accurate project instructions.

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
- Remove redundant or contradictory instructions.

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

Before creating additional instruction files:

1. Inspect which instruction formats are supported by the tools used in the project.
2. Identify whether any tool requires additional compatibility configuration.
3. Keep tool-specific instructions separate from shared engineering standards.
4. Avoid copying the entire contents of `AGENTS.md` into other files.
5. Create additional compatibility files only when necessary and justified.

Do not assume that all tools interpret instruction files identically. Verify behavior where possible and clearly document any limitations.

Do not create unnecessary agent definitions, skills, hooks, or tool configurations as part of this task.

---

## Phase 6 — Create AGENTS.md

After completing the investigation and resolving essential uncertainties:

1. Create `AGENTS.md` at the repository root.
2. Use the agreed structure, adapting it to the actual project.
3. Include verified project information and technology details only where useful.
4. Apply the shared engineering standards described in this prompt.
5. Include the relevant documentation index and mandatory reading requirements.
6. Preserve important project-specific constraints.
7. Keep the instructions concise, actionable, and maintainable.
8. Do not create or modify unrelated files.

If essential information remains missing, ask for clarification before writing assumptions into the file.

---

## Phase 7 — Validate AGENTS.md

After creating the file:

1. Review the complete document.
2. Verify that project descriptions and technology details match repository evidence.
3. Verify all referenced files, paths, and links.
4. Check that the instructions do not contradict each other.
5. Confirm that shared standards are technology-agnostic.
6. Confirm that security, testing, documentation, and code review guidance are present.
7. Confirm that important project-specific requirements have not been omitted.
8. Check that the document is concise and does not duplicate existing specialized guidance.
9. Ensure no unrelated project files were changed.
10. Confirm no kernel rule was dropped or weakened (Phase 0).

**Never commit or push.** Stop after validation and hand off with the report below.

---

## Phase 8 — Final Response (Handoff)

Provide a concise report containing:

1. **What and why:** What was created and the reason for the main choices.
2. **Files changed:** Grouped by purpose, with paths. Include `AGENTS.md` and any compatibility file.
3. **Project understanding:** A brief summary of the discovered project purpose, architecture, and technology stack.
4. **Instructions included:** The main standards and workflows established, and which came from the kernel.
5. **Sources used:** The project documentation and files used to derive the instructions.
6. **Validation:** Checks performed and their actual results.
7. **How to test:** Steps to verify the file works (e.g. start a fresh agent session and confirm it follows the rules).
8. **Step-by-step guide:** Numbered next actions for the user, including review and commit.
9. **Suggested commit message:** Conventional Commits format (e.g. `docs: add AGENTS.md`).
10. **What became configurable:** Any project values, toggles, or settings the file now exposes or points to; "none" if nothing.
11. **Unknowns:** Any missing information, assumptions, or unresolved questions.

If essential information could not be established, explain the limitation rather than presenting an incomplete or speculative instruction file as authoritative.

**Definition of done:** A root-level `AGENTS.md` exists, accurately reflects the project, provides actionable shared engineering standards, preserves verified project constraints, and can guide all supported coding agents without relying on technology-specific assumptions for its core principles.

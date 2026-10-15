# ship-band

A band above the prompt that shows which delivery step the current branch is on, with a button that puts the next step's prompt in the box. You can see at a glance whether the review and the security scan were done.

```
#12345 feat/xyz  WI ✓ Plan ✓ Impl ✓ Tests ✓ Review ● Security ○ Docs ○ Commit ○ PR ○ Merged ○   [Next: /code-review]
```

## Install

This is a Claude Code mod (a function-hook plugin). It lives in a folder marketplace named `nuno-mods`:

```
/plugin install ship-band --marketplace SilverX21/personal-ai-settings
```

There are no install options. To install from a local clone, add the repository folder as a marketplace and install from it. After you edit the mod, run `/reload-plugins`.

The band needs a git repository. Start Claude Code inside one, because the branch is read when the session starts and after `git checkout` or `git switch`.

## Steps

State is kept per repository and branch. A step is marked done when:

| Step | Marked done when |
|---|---|
| WI | the `azure-wi` skill is used, or the branch names the item (see below). Hidden when the repo has no work-item source |
| Plan | `ExitPlanMode`, the `plan` skill, or a write to `docs/plans/*.md` |
| Impl | a source file is edited or written. Docs, `.claude` files and text or Markdown files do not count |
| Tests | a test command exits with success (`vitest`, `jest`, `pytest`, `dotnet test`, `go test`, `cargo test`, `npm`/`pnpm`/`yarn` test scripts, `nx … test`) |
| Review | the `code-review` skill completes |
| Security | the `security-review` skill completes |
| Docs | the `document-feature` skill completes |
| Commit | `git commit` succeeds |
| PR | `az repos pr create` succeeds. The `prepare-pr` skill only records that the PR is prepared |
| Merged | **Mark merged**, or `az repos pr show` reports `completed` |

A skill counts when the turn that ran it ends normally. A subagent finishing does not count. An edit after Review or Security marks it stale (`⟳`) until you run it again. No other step goes stale.

## The Next button

**Next** fills the prompt with the current step's text: `/plan `, `Implement the plan.`, `Run the tests for the affected slice.`, `/code-review`, `/security-review`, `/document-feature`, `commit`, `/prepare-pr`, and then `push and create the PR` once the PR is prepared. You still press Enter. Once a PR is open, **Mark merged** appears too.

## Work items

The first time the band opens in a repository it asks where the work items live, and remembers the answer per repository:

| Choice | WI step | Branch gives the item id |
|---|---|---|
| Azure DevOps | `/azure-wi ` fills the prompt | a five-digit number |
| GitHub issues | asks to fetch the issue with `gh issue view` | a number after `/` or `-`, or `#12` |
| Nowhere | hidden | none |

Until you answer, the band behaves as Azure DevOps. If you dismiss the question, the repository is remembered as dismissed and it is not asked again. Run `/ship-band source` when you want to answer later. PR and merge detection use the Azure CLI only, so with GitHub you close the PR step by hand.

## Commands

| Command | What it does |
|---|---|
| `/ship-band` | Prints the band line |
| `/ship-band source` | Asks where the work items live |
| `/ship-band source azure`, `github` or `none` | Sets it without asking |
| `/ship-band reset` | Clears the steps for this branch |
| `/ship-band off` and `/ship-band on` | Hides or shows the band |

## Limits

- The store keeps the last 50 repository and branch pairs.
- Test detection looks at the command text and a successful exit, so a command such as `echo vitest` counts.
- `session-meter` draws in the same place. Both bands show, one above the other.

## Development

```
claude plugin validate claude/mods/ship-band
claude plugin test claude/mods/ship-band
```

# aws-terraform-master shakedown report

Read-only reconnaissance against two real Terraform repositories. No `terraform
init/plan/apply/destroy/state`, no `aws` CLI, no credentials used, nothing written
into either repo. Referred to below as **Repo A** and **Repo B** — see Confidentiality.

A third target (`findings-infra.tsv`, left over from earlier prep) could not be
mapped back to a repo on this machine and is excluded from judgement. Its two
findings (`backend_lock` ×2, one file, name `versions.tf`) are structurally
identical to Repo A's false positive below and are very likely the same defect,
but that is inference, not verification, so they are not counted in the totals.

Task 2 (reference loading) and repo-specific Task 3 probes were not run this
pass — the session ran out before reaching them. Everything else in the shakedown
protocol is complete.

## Part 1 — per repo

### Repo A

- ~50 `.tf`/`.tfvars` files across a root module and several submodules, plus
  per-customer variable files (`customers/<name>/`) — this is a multi-tenant
  onboarding stack, not a single environment.
- Plain Terraform, no Terragrunt. `backend "s3" {}` — empty block, backend
  configured externally at `init` time rather than in-repo.
- No `required_version` constraint anywhere in the repo.
- Fired: `backend_lock.no_lock` ×1, `backend_lock.no_encrypt` ×1,
  `hardcoded_secret` ×1, `unpinned_module` ×3, `provisioner` ×3. 9 findings.
- Judgement: 6 true positive, 2 false positive, 1 technically-true-not-worth-flagging.

### Repo B

- ~14 `.tf` files, one `infra/` subdirectory holding the Terraform.
- Plain Terraform. `backend "s3" {}` fully specified in-repo: bucket, key,
  region, `dynamodb_table`, `encrypt = true`.
- `required_version` constraints present and current (several files pinned
  `>= 1.9`–`>= 1.10`).
- Fired: `dynamodb_lock` ×1. 1 finding.
- Judgement: 1 true positive.

Both repos failed `terraform fmt -check -recursive` (Repo A: 3 files, Repo B: 1
file) before judgement began. Neither non-fmt file overlapped with a flagged
file, so hypothesis #7 (line-anchored rules breaking on unformatted HCL) does
not explain any finding here — but it remains a live defect and would have,
had the overlap gone the other way. Confirming fmt status per file before
trusting a zero count is now a hard precondition, not a nice-to-have.

## Part 2 — the skill

### Task 0 — baseline suite

79 passed, 0 failed, on this machine, from a bare clone with nothing installed
into `~/.claude`. Two of those 79 cases exist because this shakedown found and
fixed two guard defects mid-session (below) — the suite was 67 at the start of
the exercise.

### Per rule

| Rule | A | B | TP | FP | Verdict |
|---|---|---|---|---|---|
| `backend_lock.no_lock` | 1 | 0 | 0 | 1 | **tune** — skip on an empty backend block |
| `backend_lock.no_encrypt` | 1 | 0 | 0 | 1 | **tune** — same fix, same block |
| `dynamodb_lock` | 0 | 1 | 1 | 0 | keep |
| `hardcoded_secret` | 1 | 0 | 0 | 0† | keep, see note |
| `unpinned_module` | 3 | 0 | 3 | 0 | keep |
| `provisioner` | 3 | 0 | 3 | 0 | keep, understates density (see False negatives) |

† Not false-positive in the strict sense — the flagged line genuinely is an
unguarded secret field. It sits in a config block whose feature flag is
disabled, next to sibling fields that are visibly placeholder strings, and the
value itself reads as a placeholder (short, low entropy, no interpolation). Real
disposition: technically true, not worth a human's time. Counted separately
from the FP row above because the rule did not misfire — the code around the
finding is what makes it low value.

### False positives — highest-value section

**`backend_lock` (both sub-rules) fires on an empty `backend "s3" {}` block.**
Terraform legitimately allows a *partial* backend configuration in the file,
with the rest supplied via `-backend-config` at `init` time — this is a common
pattern for keeping bucket/key/table values out of version control and
supplying them per-environment or per-CI-pipeline. The rule sees `backend "s3"`
and demands `encrypt`/`use_lockfile` be present in the same file; it has no way
to know the block is deliberately incomplete and finished elsewhere. This is
neither the line-scoping nor cross-file-awareness failure mode anticipated
going in — it is a third mode: **the rule cannot distinguish a partial backend
from a complete one.** Fix: skip both `backend_lock` checks when the `backend
"s3"` block body is empty (no arguments at all) rather than only checking for
the presence of specific keys — an empty block is a distinct, legitimate case,
not the same as a fully-specified block missing an argument.

Confirming the mechanism is not confused with hypothesis #7: the flagged file
in Repo A was itself `terraform fmt`-clean, and Repo B's fully-specified
backend correctly produced no findings, in the same file shape the rule
otherwise struggles with (multi-line HCL, one argument per line). So the rule's
logic is sound when the block has content — it just cannot recognize "no
content yet, deliberately."

### False negatives — confirmed on production code

**`provisioner` reports fewer than it should density 8→3, exactly as hypothesis #6 predicted.**
Repo A has 8 `provisioner "local-exec"` blocks across the 3 flagged files (2, 2,
4 respectively); file-level reporting collapses each file to one finding.

**The prefixed-secret-field gap (documented false negative, hypothesis list)
is not theoretical — it missed 7 real values in Repo A**, all in the same two
files that produced the one true `hardcoded_secret` finding above. All 7 are
assigned to fields whose names end in `Password`, `Secret`, or
`ConnectionString`, none of which start the line — a `MetricPassword`,
`ClientSecret`, `SQLConnectionString`, `CommonConnectionString`, and an
`EasyCubeClientSecret` all sit past the point the rule's anchor requires. All
seven look like real credentials (high character diversity, no placeholder
wording, no `${...}` interpolation, one is 235 characters), all seven are
committed and present in `HEAD`, and the file has been touched across 4
commits going back roughly seven months. This has been separately reported to
the user for rotation — it is out of scope for a linter finding, but it is the
single most consequential thing this shakedown surfaced, and it happened
precisely because the rule as written cannot see it. The net effect on this
rule's real-world hit rate: 1 low-value true positive, 7 misses. Inverted
signal-to-noise on the rule that matters most.

**Two gaps with no corresponding rule at all**, found while reading the
provisioner findings rather than predicted going in:

1. A database password is passed as a `-P` command-line argument to a shell
   tool inside 3 `local-exec` blocks, 11 times total across Repo A. A CLI
   argument is visible in process listings and commonly lands in CI logs —
   this is a distinct and arguably worse exposure than the value merely
   sitting in a `.tf` file, and nothing in the current rule set looks for it.
   Notably, one of the three affected modules also demonstrates the *correct*
   pattern elsewhere in the same file (passing the same kind of value via an
   `environment` block instead) — so the fix pattern already exists in this
   codebase, just inconsistently applied.
2. Repo A has zero `required_version` constraints anywhere, while Repo B has
   four, current and correctly pinned. The skill's own README states the
   standards "flag version floors explicitly" — there is no rule that does.

### References

Not evaluated this pass — Task 2 was not reached.

### Finding #0 — hook wiring

Confirmed empirically, not just from reading the source: `jq '.hooks'` and
`jq '.enabledPlugins'` against this machine's live `settings.json` both return
empty, with the skill cloned but never linked or enabled. The hooks are inert
under every install path — a plain clone, and even `install.sh --link-only`,
since the hook commands are keyed on `${CLAUDE_PLUGIN_ROOT}`, which only a
plugin-manager-enabled install populates. The skill's README describes
`hooks/` as "deterministic enforcement, scoped to Terraform files only"
without stating anywhere that plugin enablement is a precondition — a team
that reads the README and installs by symlink or clone (both plausible, both
documented elsewhere as supported) will believe they have enforcement they do
not have. This is misleading by omission, not by false statement, which is
arguably worse: nothing in the reading experience prompts the question.

### Guard — probes and two fixed defects

Generic probe sweep (not repo-specific — Task 2/3 targeting was not reached)
found two real defects, both already fixed and re-verified as regressions in
this same session:

1. **`aws s3 rm`/`aws s3 rb` bypassed the destructive-command deny list.** The
   deny branch matched spelled-out verbs (`delete`, `terminate`, ...); the `s3`
   shorthand commands are abbreviations and fell through to `ask` while the
   `s3api` equivalent of the same operation (`delete-bucket`,
   `delete-object`) was correctly denied. Same irreversible action, two
   different guard decisions depending on which CLI form was used. Fixed.
2. **Multi-line commands defeated the mention-vs-invocation check.** The
   guard's anchor for "is this destructive command actually being run"
   matches line by line, so it could not tell a heredoc *body* — plain text
   being written to a file — from a second, real command. This blocked
   legitimate authoring (writing documentation or test fixtures containing an
   example command) with a `deny`, and was reproduced live while working on
   this skill's own scripts. Fixed by stripping heredoc bodies before
   matching.

Neither defect was visible from reading the source; both were found by probing
the guard directly with constructed inputs. Everything else probed behaved
correctly: mention-not-invocation cases (`grep`/`rg` naming a destructive
command in a string) all correctly allow, state-file and secret-file access
correctly deny, template files (`.tfvars.example`, `.env.example`) correctly
allow, and the full `terraform`/`aws` mutating-verb matrix denies or asks as
documented. No repo-specific command list was probed this pass.

### Anything the skill got flatly wrong

The line-start anchoring used by nearly every anti-pattern rule is the
single largest source of both false positives and false negatives found
this session, and it was not something that could be predicted from the
false-positive hypotheses prepared going in — it was found by testing
identically-worded HCL with and without `terraform fmt` applied. An
unformatted file makes every anchored rule (positive checks: silent; negative
checks: they invert and accuse correctly-configured code of being wrong)
unreliable in both directions simultaneously. `terraform fmt -check` is not
optional pre-flight hygiene for this linter — it is a correctness precondition
the skill does not state anywhere.

## Part 3 — verdict

Not fit to point at a real repo unattended yet, but closer to fit than the
finding count suggests: of the two repos actually judged, every finding was
either a true positive or explainable by one clearly-scoped defect
(`backend_lock` vs. an empty/partial backend block), and the rules that fired
correctly did real, useful work — including surfacing an active credential
exposure the rule set wasn't even designed to catch. Fix order:

1. **Skip `backend_lock` checks on an empty `backend "s3" {}` block.** Smallest
   diff, removes the only outright false positive found, one-line change.
2. **Widen the secret-field regex to match a prefixed field name**, not just
   one anchored at line start. This is the fix that would have caught the
   7 missed credentials in Repo A — the highest real-world stakes of anything
   in this report.
3. **Fix the anchoring class of bug properly** (either strip to real argument
   position before matching, or move the anti-pattern rules onto an HCL parser
   instead of line-oriented grep) rather than patching each affected rule
   individually — line anchoring is the root cause behind the false-negative
   and the inverted-false-positive behavior both, and behind hypothesis #7
   generally, and there are more affected rules than the two that happened to
   fire in these two repos.
4. Add the two missing rules (secret-shaped value as a CLI argument;
   `required_version` absent) once the above is stable.
5. Fix the README's hook-wiring claim to state plugin enablement is required —
   cheap, and it is the difference between a team believing they have
   enforcement and actually having it.

Everything under Guard is already fixed and verified; nothing further needed
there from this pass.

## Confidentiality note

Repository names, module source URLs (which embedded an internal Azure DevOps
organization and project name), and one directory naming a specific customer
were all visible during this session's investigation and are deliberately
excluded here. Nothing above should be read as more specific than "two real
Terraform repositories of the given rough shape" — no bucket, ARN, account ID,
CIDR block, or verbatim HCL appears in this report, and paths are given in
shape only (`modules/<name>/main.tf`, `customers/<name>/`).

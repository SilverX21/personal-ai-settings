# Shakedown prompt — aws-terraform-master vs. real Terraform repo

I'm shaking down the `aws-terraform-master` skill against a real Terraform repo.
It's company infrastructure — this is READ-ONLY reconnaissance. Hard rules:

- Never run `terraform init`, `plan`, `apply`, `destroy`, or `state` anything.
- Never run any `aws` CLI command.
- Never need or use AWS credentials.
- Never modify a single file in the infra repo.
- You are reading `.tf` / `.tfvars` text as static text. That is all.

All working output goes to `~/tf-shakedown/` — outside the infra repo, outside the
settings repo. Nothing is written into either repo.

## SETUP (once)

```bash
git clone https://github.com/SilverX21/personal-ai-settings.git ~/personal-ai-settings
export SKILL=~/personal-ai-settings/skills/aws-terraform-master
test -d "$SKILL" && echo OK
mkdir -p ~/tf-shakedown
```

Deliberately no `install.sh`. Every script below resolves its own directory and runs
straight from the clone — verified: the full suite passes, and the linter and guard
both work, with `~/.claude` never involved. Running `install.sh --link-only` on a
company machine would instead symlink all three of my skills plus an agent into
`~/.claude`, replace any same-named skill already there, and overwrite
`~/.agents/.skill-lock.json` — which changes skill resolution for that whole account,
not just this exercise. It backs up what it replaces, but none of it is needed here.

`SKILL` is exported so `sweep.sh` inherits it; re-set it in any new terminal, or the
sweep aborts with a message rather than running against a nonexistent linter.

### Known: the hooks are DORMANT here, by design of the shakedown

Nothing is installed: the clone is not linked into `~/.claude` and the plugin is not
enabled. Even under `install.sh`, which symlinks `skills/*/` and never touches
`settings.json`, the hooks would still be dormant — `hooks/hooks.json` is keyed on
`${CLAUDE_PLUGIN_ROOT}`, which is only populated for an *enabled plugin*. Either way
`guard.sh` and `lint-antipatterns.sh` will **not fire automatically** — no PostToolUse
lint on edit, no PreToolUse guard on Bash.

This is deliberate here: we are testing the rules' *judgement*, and both scripts are
invoked directly on stdin below. Do **not** try to enable the plugin on a company
machine to "fix" this.

The stake in that last sentence is not hypothetical. There is a **third** hook,
`format.sh`, on the same PostToolUse matcher as the linter, and it runs `terraform fmt`
**in place**. Enabling the plugin would make every Edit or Write in the infra repo
rewrite the file it touched. Dormancy is what keeps this run read-only, so `format.sh`
is never invoked below — only `guard.sh` and `lint-antipatterns.sh`, both of which
only read and print.

Confirm it rather than assuming it, and record it as finding #0:

```bash
jq '.hooks // {}' ~/.claude/settings.json
jq '.enabledPlugins // {}' ~/.claude/settings.json
```

## TASK 0 — baseline the linter on its own fixtures

```bash
"$SKILL"/scripts/test-hooks.sh 2>&1 \
  | tee ~/tf-shakedown/00-baseline.txt
```

This is the author's own regression suite. It tells you what each rule is *intended*
to catch, which is the yardstick for judging every finding in Task 1. Record any
test that fails here — a rule broken against its own fixtures is a different class
of defect from a rule that misfires on real code.

## TASK 1 — linter sweep

The linter is a PostToolUse hook: it reads hook JSON on stdin, not a file argument.
It emits `{"decision":"block","reason":"..."}` on findings and nothing at all when
clean. The reason text contains **absolute paths** — never paste raw sweep output
into the report.

Save as `~/tf-shakedown/sweep.sh` and run it from the infra repo root:

```bash
#!/usr/bin/env bash
# Read-only sweep. Executes no terraform, no aws, writes nothing into the repo.
set -uo pipefail
# The linter calls require_jq, which `exit 0`s SILENTLY when jq is absent. Without this
# check every file reads as clean and a zero count is indistinguishable from a pass.
command -v jq >/dev/null 2>&1 || { echo "jq missing: the linter fails open and silent, so every count below would be a lie. Install jq first." >&2; exit 1; }
LINT="${SKILL:?set SKILL to the cloned skill dir}"/scripts/lint-antipatterns.sh
ROOT="$(pwd)"
# Named after the repo being swept. A fixed filename plus the `: >` truncation below
# means sweeping a second repo silently destroys the first one's findings.
OUT=~/tf-shakedown/findings-$(basename "$ROOT").tsv
: > "$OUT"

# reason-substring -> rule name. Built from the add() strings in the script.
# backend_lock emits TWO distinct findings; they are counted separately.
map() {
  grep -qF 'DynamoDB state locking is DEPRECATED' <<<"$1" && echo dynamodb_lock
  grep -qF 'S3 backend without state locking'     <<<"$1" && echo backend_lock.no_lock
  grep -qF 'S3 backend without `encrypt = true`'  <<<"$1" && echo backend_lock.no_encrypt
  grep -qF 'Hardcoded secret literal'             <<<"$1" && echo hardcoded_secret
  grep -qF 'without a write-only argument'        <<<"$1" && echo password_in_state
  grep -qF 'Wildcard IAM action'                  <<<"$1" && echo wildcard_iam
  grep -qF 'Heredoc JSON IAM policy'              <<<"$1" && echo heredoc_policy
  grep -qF 'Remote module source pinned to a branch' <<<"$1" && echo unpinned_module
  grep -qF 'block inside a module'                <<<"$1" && echo module_provider
  grep -qF 'ignore_changes = all'                 <<<"$1" && echo ignore_changes_all
  grep -qF '`provisioner` block.'                 <<<"$1" && echo provisioner
  grep -qF 'without `retention_in_days`'          <<<"$1" && echo log_retention
  grep -qF 'SSH (22) or RDP (3389)'               <<<"$1" && echo open_admin_port
}

while IFS= read -r -d '' f; do
  abs="$ROOT/${f#./}"
  out=$(jq -nc --arg p "$abs" '{tool_input:{file_path:$p}}' | "$LINT")
  [ -n "$out" ] || continue
  reason=$(jq -r '.reason' <<<"$out")
  while read -r rule; do
    [ -n "$rule" ] && printf '%s\t%s\n' "$rule" "${f#./}" >> "$OUT"
  done < <(map "$reason")
done < <(find . \( -name '*.tf' -o -name '*.tfvars' \) \
              -not -path './.terraform/*' -not -path './.git/*' -print0)

echo "--- fired counts ---"
cut -f1 "$OUT" | sort | uniq -c | sort -rn
echo "--- files scanned ---"
find . \( -name '*.tf' -o -name '*.tfvars' \) -not -path './.terraform/*' | wc -l
```

`findings-<repo>.tsv` is `rule<TAB>relative-path`. It stays local — you need real paths to
open each file and judge it.

**For EVERY finding, open the file and judge it yourself: true positive, false
positive, or technically-true-but-not-worth-flagging.** That judgement is the entire
point — raw counts are useless.

### False-positive hypotheses to test specifically

I read the detector source. Every rule is a **whole-file grep**, not line-scoped, so
these are the predicted misfire modes. Confirm or refute each:

1. **`open_admin_port`** — fires when a file contains `0.0.0.0/0` *anywhere* AND
   `from_port`/`to_port` of 22 or 3389 *anywhere*. A file holding an egress rule to
   0.0.0.0/0 plus an unrelated SSH ingress from a private CIDR will misfire. Expect
   this to be the top FP source.
2. **`password_in_state`** — needs `random_password` and no `_wo` **in the same
   file**. A `random_password` in one file consumed by a `*_wo` argument in another
   misfires.
3. **`unpinned_module`** — the pin check is `?ref=[0-9a-fv]`. A tag like
   `?ref=release-5.1` or `?ref=stable` reads as unpinned. Also file-scoped, so one
   pinned + one unpinned module in the same file behaves unpredictably.
4. **`strip_comments` only removes full-line comments**, not trailing ones. A
   trailing comment containing `0.0.0.0/0`, a password-shaped literal, or `"*"` still
   matches. Check whether any finding traces to a comment.
5. **`module_provider` only applies to paths matching `*/modules/*`.** If this repo
   nests reusable modules under a different directory name, the rule silently never
   fires — a false negative, not a clean pass.
6. **Findings are file-level, not line-level.** Three wildcard IAM actions in one
   file report as one finding. Note wherever this understates real density.
7. **Nearly every rule is anchored to the start of a line**, so HCL that puts an
   argument on the same line as its block opener escapes the pattern entirely. Confirmed
   on fixtures, and it breaks in *both* directions depending on what the anchored grep
   is looking for:
   - Anchored **positive** checks go silent — `dynamodb_lock`, `hardcoded_secret`,
     `wildcard_iam`, `heredoc_policy`, `unpinned_module`, `module_provider` and
     `provisioner` all found nothing in a one-line file and every finding in the same
     content reformatted. False negatives.
   - Anchored **negative** checks invert and fire on correct code — a one-line
     `backend "s3"` holding `encrypt = true` and `use_lockfile = true`, and a one-line
     log group holding `retention_in_days`, produced three findings accusing the file
     of missing all three. False positives on Terraform that is already right.

   `terraform fmt` puts every argument on its own line, so a fmt-clean repo is not
   affected. That makes fmt status a **precondition for reading this repo's counts at
   all**: run `terraform fmt -check -recursive` first, and if it is not clean, treat
   both the zeros and the backend/retention findings as unreliable until it is.

### Never-fired rules — check for false negatives

For every rule with a zero count, grep the repo for the *concept* rather than the
detector's pattern, and say which explanation holds:

| Rule | Concept grep | Zero means |
|---|---|---|
| `log_retention` | `aws_cloudwatch_log_group` | no log groups / all set retention / detector missed |
| `heredoc_policy` | `assume_role_policy`, `policy =` | genuinely uses `aws_iam_policy_document` / missed |
| `module_provider` | `provider "` inside reusable-module dirs | no such dirs / path assumption wrong |
| `dynamodb_lock` + `backend_lock` | `backend "s3"` | backend not in this repo (Terragrunt? separate bootstrap?) |
| `provisioner` | `provisioner` | genuinely clean / missed |
| `hardcoded_secret` | `_password[[:space:]]*=`, `_secret`, `_token`, `_key` | **CONFIRMED FN, see below** |
| `unpinned_module` (zero *despite* remote modules) | `\?ref=` | **CONFIRMED FN, see below** |

A rule that never fires because the repo does not have the pattern is a pass. A rule
that never fires because the detector's assumption does not match this repo's layout
is a defect, and a more serious one than a false positive.

### Two false negatives already confirmed against fixtures — do not re-derive, quantify

Both were reproduced on synthetic `.tf` files before this run. Treat a zero count from
either rule as meaningless and go straight to the concept grep, then report **how many
real instances the detector missed** in this repo.

1. **`hardcoded_secret` misses every prefixed field name.** The rule anchors on
   `^[[:space:]]*(password|secret|token|api_key|access_key|secret_key|private_key)`, so
   the keyword must start the line. `master_password = "..."` and `db_password = "..."`
   produce **zero findings** — and `master_password` is the most common hardcoded-secret
   shape in AWS Terraform. Fix is a shifted regex (allow an optional `[a-z_]*` prefix
   before the keyword), not dropping the anchor.
2. **`unpinned_module`: one pinned module launders every unpinned one in the same file.**
   The escape clause is a file-wide `! grep -q '?ref=[0-9a-fv]'`. A branch named
   `feature-x` starts with `f`, which is in that class, so it reads as a commit hash *and*
   silences a sibling `?ref=main` in the same file — both together produce zero findings.
   Any ref starting `a`–`f`, `v`, or a digit passes as pinned. Fix is line-scoping plus a
   real pattern, e.g. `\?ref=([0-9a-f]{7,40}|v?[0-9]+\.[0-9]+)`.

## TASK 2 — reference loading

Ask the skill 3–4 real architecture questions about this repo — module boundaries,
state layout, network topology, cost posture. Watch the tool calls: record whether
any file under `references/` was actually **Read**, or whether SKILL.md alone
answered. Name the specific reference file, if any.

The eight references are: `well-architected`, `networking`, `multi-account`,
`service-selection`, `cost`, `operations`, `debugging`, `antipatterns`. Note that
`debugging.md` (12KB, the largest) is unreachable in a read-only run by design — it
covers live investigation. Expect it not to load; that is not a finding.

For each reference that never loaded: should it have, given the question asked?

## TASK 3 — guard friction

Guard is a PreToolUse hook, and per finding #0 it is **not wired up** — so there is
no organic friction to observe. Do not try to measure it by working normally; that
measures nothing and reads as a false pass. Probe it directly instead.

Feed command strings to guard.sh on stdin. This executes nothing — the guard only
prints a JSON decision:

```bash
# The guard prints NOTHING on allow. `jq -r '.x // "allow"'` does not help: with empty
# stdin jq has no input to apply the default to, so it emits nothing and the allow rows
# vanish. Default in the shell instead, or the whole table comes back blank.
probe() {
  d=$(jq -nc --arg c "$1" '{tool_name:"Bash",tool_input:{command:$c}}' \
      | "$SKILL"/scripts/guard.sh \
      | jq -r '.hookSpecificOutput.permissionDecision' 2>/dev/null)
  printf '%-6s %s\n' "${d:-allow}" "$1"
}
# real commands this repo's workflow would actually use — adapt to its docs/Makefile/CI
probe 'terraform plan -out=tfplan'
probe 'terraform fmt -check -recursive'
probe 'terragrunt run-all plan'
probe 'aws sts get-caller-identity'
probe 'grep -r terraform ./docs'
probe 'rg "terraform destroy" README.md'
```

Take the command list from this repo's own README / Makefile / CI workflows — the
question is whether the guard obstructs *this team's real workflow*, not a synthetic
one. Flag any decision that is noise rather than a real checkpoint, and any `allow`
that should have been an `ask`.

File-access probes: `{"tool_name":"Read","tool_input":{"file_path":"<path>"}}`. Check
whether guard's `SECRET_PATTERN` (`.key$`, `.pem$`, `.env*`, `secrets.auto.tfvars`)
denies any file this repo legitimately needs read.

### Two guard defects found and already fixed — probe them as regressions

Both were found by probing the guard directly during preparation, and both are fixed in
this clone. Re-probe them: the point now is that they *stay* fixed, and a `deny` where
the table says `allow` is a regression, not a discovery.

**1. Multi-line commands (`BINPRE` vs heredocs).** `BINPRE` exists so a command that
merely *mentions* a destructive one is not read as invoking it. On a single line it
always worked, but `grep -E` matches line by line, so the `^` anchored at the start of
every line of the command string rather than the start of a shell command — making a
heredoc body indistinguishable from a real second command. It fired twice while editing
this skill's own scripts. `strip_heredocs()` now drops heredoc bodies before matching.

| Command string | Expected |
|---|---|
| `rg "<destructive>" README.md` — single line, quoted | allow |
| heredoc whose body line is `<destructive>` | allow |
| `python3 - <<'PY'` with `<destructive>` inside a Python string | allow |
| `<<-` indented heredoc body | allow |
| `<destructive>` after a *closed* heredoc | deny |
| genuine second line `<destructive>` | deny |

Still open, deliberately: a multi-line **quoted string** that is not a heredoc still
misfires, and an unterminated heredoc swallows the rest of the string. Neither is
exploitable — bash will not run an unterminated heredoc — but say if you disagree.

**2. `aws s3` shorthand escaped the deny branch.** The deny list spelled its verbs out,
so `s3 rm` and `s3 rb` fell through to `ask` while `s3api delete-object` and
`delete-bucket` were denied — the same irreversible operation getting two decisions.
Now denied. `s3 ls` must still be `allow`, and `cp` / `sync` / `mv` stay at `ask`.

Report both under Guard as *found and fixed during the shakedown*, and note that the
generic probe sweep is what surfaced them — neither was visible from reading the source.

## DELIVERABLE

Write `~/tf-shakedown/SHAKEDOWN-REPORT.md` (outside every repo; nothing committed).

Three targets were swept. Refer to them as **Repo A / B / C** throughout. The mapping
from label to real repository lives only in your local notes and never enters the
report — see CONFIDENTIALITY.

### Part 1 — per repo, brief

One block each for A, B, C. This is the evidence base, not the analysis:

- **Shape** — file count, module count, rough age, community vs in-house module mix,
  plain Terraform or Terragrunt, and how state is split.
- **Fired counts** — rule → count, from that repo's `findings-<repo>.tsv`.
- **Judgement totals** — of those findings, how many true positive, false positive, and
  technically-true-but-not-worth-flagging.

### Part 2 — the skill, across all three

The actual deliverable. Every claim here says which repos it holds in.

- **Task 0** — baseline suite pass/fail. Machine-level, recorded once.
- **Per rule** — one row per rule, with the per-repo split visible:

  | Rule | A | B | C | TP | FP | Verdict |

  A rule that fires four times in one repo and never in the other two is a different
  signal from one that fires everywhere, and a single total hides that. `backend_lock`
  counted as its two findings. Verdict: keep / tune / disable-by-default.
- **Every false positive** — rule, which repo, why it misfired, and what the pattern
  should have been instead. **This is the highest-value section.** Say whether the fix
  is line-scoping, cross-file awareness, or a narrower regex. Group by rule rather than
  by repo: the same misfire seen in three repos is one defect with three witnesses, not
  three findings.
- **False negatives** — rules that never fired where the concept was present, and in
  which repos. Silent in all three because no repo has the pattern is a pass; silent
  because the detector's assumption does not match the layout is a defect, and the more
  serious one.
- **References** — which loaded, which never did, whether the ones that didn't should
  have. Say which repo each question was about; a question about a Terragrunt repo and
  one about plain Terraform should not pull the same references.
- **Finding #0 — hook wiring.** Confirm the hooks are dormant, and say whether the
  skill's own README is misleading about it (it describes `hooks/` as "deterministic
  enforcement" without stating that plugin enablement is required).
- **Guard** — probe results only, split per repo wherever their real command lists
  differ. Any decision that would obstruct that team's workflow, and any `allow` that
  should have been an `ask`.
- **Anything the skill got flatly wrong about real-world Terraform.**

### Part 3 — verdict

One paragraph. Is the skill fit to point at a real Terraform repo as it stands, what
has to change before it is, and in what order would you fix it.

## CONFIDENTIALITY

`findings-<repo>.tsv`, the raw sweep output, and the A/B/C label mapping are working
material and **never travel** — they hold real paths and real repository names. Keep
them in `~/tf-shakedown/`. Only `SHAKEDOWN-REPORT.md` travels, to a personal repo.

The repository names are themselves company information, which is why the report uses
A / B / C. Distinguishing detail identifies a repo as surely as its slug does — naming
the product line, the customer, or the workload it serves is naming the repo. Describe
a target by shape only: its size, its tooling, how its state is split.

The report must contain NO company code: no verbatim HCL, no ARNs, no account IDs,
no CIDR blocks, no bucket / domain / service / module names. Paraphrase findings ("a
security group rule opened an admin port to a wide CIDR"), never quote them.
Sanitize paths to their shape — `modules/<name>/main.tf`, `envs/<env>/main.tf`.
Note that the linter's own output embeds absolute paths; never paste it.

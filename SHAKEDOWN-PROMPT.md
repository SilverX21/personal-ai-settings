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
git clone <personal-ai-settings repo url> ~/personal-ai-settings
cd ~/personal-ai-settings && ./install.sh --link-only
test -d ~/.claude/skills/aws-terraform-master && echo OK
mkdir -p ~/tf-shakedown
```

### Known: the hooks are DORMANT under this install, by design of the shakedown

`install.sh` symlinks `skills/*/` into `~/.claude/skills/` and never touches
`settings.json`. The skill's `hooks/hooks.json` is keyed on `${CLAUDE_PLUGIN_ROOT}`,
which is only populated for an *enabled plugin*. So `guard.sh` and
`lint-antipatterns.sh` will **not fire automatically** — no PostToolUse lint on edit,
no PreToolUse guard on Bash.

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
~/.claude/skills/aws-terraform-master/scripts/test-hooks.sh 2>&1 \
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
LINT=~/.claude/skills/aws-terraform-master/scripts/lint-antipatterns.sh
ROOT="$(pwd)"
OUT=~/tf-shakedown/findings.tsv
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

`findings.tsv` is `rule<TAB>relative-path`. It stays local — you need real paths to
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
      | ~/.claude/skills/aws-terraform-master/scripts/guard.sh \
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

## DELIVERABLE

Write `~/tf-shakedown/SHAKEDOWN-REPORT.md` (outside both repos; nothing committed):

- **Repo shape** — file count, module count, rough age, community vs in-house mix,
  whether it uses plain Terraform or Terragrunt, and how state is split.
- **Task 0** — baseline suite pass/fail.
- **Per rule** — fired count, true positives, false positives, verdict
  (keep / tune / disable-by-default). `backend_lock` counted as its two findings.
- **Every false positive** — which rule, why it misfired, what the pattern should
  have been instead. **This is the highest-value section.** Say whether the fix is
  line-scoping, cross-file awareness, or a narrower regex.
- **False negatives** — rules that never fired where the concept was present.
- **References** — which loaded, which never did, whether the ones that didn't
  should have.
- **Finding #0 — hook wiring.** Confirm hooks are dormant under `--link-only`, and
  say whether the skill's own README is misleading about it (it describes `hooks/` as
  "deterministic enforcement" without stating that plugin enablement is required).
- **Guard** — probe results only. Any decision that would obstruct this team's real
  workflow, and any `allow` that should have been an `ask`.
- **Anything the skill got flatly wrong about real-world Terraform.**

## CONFIDENTIALITY

`findings.tsv` and the raw sweep output are working material and **never travel** —
they hold real paths. Only `SHAKEDOWN-REPORT.md` travels, to a personal repo.

The report must contain NO company code: no verbatim HCL, no ARNs, no account IDs,
no CIDR blocks, no bucket / domain / service / module names. Paraphrase findings ("a
security group rule opened an admin port to a wide CIDR"), never quote them.
Sanitize paths to their shape — `modules/<name>/main.tf`, `envs/<env>/main.tf`.
Note that the linter's own output embeds absolute paths; never paste it.

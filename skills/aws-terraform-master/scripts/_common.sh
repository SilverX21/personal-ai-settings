#!/usr/bin/env bash
# Shared helpers for the aws-terraform-master hook scripts.
# Sourced, never executed directly.

# Fail closed and silently if jq is unavailable — a hook must never break the session.
require_jq() { command -v jq >/dev/null 2>&1 || exit 0; }

# Read the edited file path out of the hook's JSON payload on stdin.
hook_file_path() { printf '%s' "$1" | jq -r '.tool_input.file_path // empty'; }

# True only for a Terraform source file this skill is allowed to touch.
# Deliberately narrow: an infrastructure repo legitimately contains YAML, Dockerfiles,
# Python and Go — those are never ours to process.
is_terraform_source() {
  local f="$1"
  case "$f" in
    *.tf|*.tfvars) ;;
    *) return 1 ;;
  esac
  case "$f" in
    */.terraform/*|.terraform/*) return 1 ;;   # provider cache / vendored modules
    */node_modules/*|*/.git/*) return 1 ;;
    *.tfstate|*.tfstate.backup) return 1 ;;    # never ours; see guard.sh
  esac
  [ -f "$f" ]
}

# True for a file inside a reusable module directory. Used to apply the
# "no provider blocks in modules" rule only where it actually applies.
is_module_file() {
  case "$1" in
    */modules/*) return 0 ;;
    *) return 1 ;;
  esac
}

# Bound the work: a hook that hangs is worse than a file that stays unformatted.
TIMEOUT_BIN=""
command -v timeout  >/dev/null 2>&1 && TIMEOUT_BIN="timeout"
command -v gtimeout >/dev/null 2>&1 && TIMEOUT_BIN="gtimeout"
run_bounded() { if [ -n "$TIMEOUT_BIN" ]; then "$TIMEOUT_BIN" "$@"; else shift; "$@"; fi; }

# Rules can be opted out per-project, e.g. TF_MASTER_SKIP_RULES=wildcard_iam,log_retention
rule_enabled() {
  case ",${TF_MASTER_SKIP_RULES:-}," in
    *",$1,"*) return 1 ;;
    *) return 0 ;;
  esac
}

# Strip content that must not be pattern-matched: `#` and `//` line comments, and the
# bodies of heredocs are left alone deliberately (an IAM policy heredoc is itself a
# finding). Cheap and line-oriented — it exists to stop false positives on prose.
strip_comments() {
  sed -E -e 's/^[[:space:]]*#.*$//' -e 's|^[[:space:]]*//.*$||' "$1"
}

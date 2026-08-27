#!/usr/bin/env bash
# PostToolUse hook (matcher: Edit|Write) — format an edited Terraform file.
#
# Scope: .tf and .tfvars only. Other languages in the repo (YAML, Python, Go, Dockerfile)
# are formatted by their own tooling.
#
# Cost: `terraform fmt` on a single file is fast and needs no init, no backend, and no
# credentials. It is still bounded by a timeout so nothing can stall the session.
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
. "$DIR/_common.sh"

require_jq
INPUT="$(cat)"
FILE="$(hook_file_path "$INPUT")"

[ -n "$FILE" ] || exit 0
is_terraform_source "$FILE" || exit 0

# Prefer whichever binary the repo actually uses. Explicit setting always wins.
FMT_BIN="${TF_MASTER_FORMATTER:-}"
if [ -z "$FMT_BIN" ]; then
  if command -v terraform >/dev/null 2>&1; then
    FMT_BIN="terraform"
  elif command -v tofu >/dev/null 2>&1; then
    FMT_BIN="tofu"
  else
    exit 0
  fi
fi
[ "$FMT_BIN" = "none" ] && exit 0

# `fmt` rewrites in place and exits non-zero when it changed something — not an error.
run_bounded 30 "$FMT_BIN" fmt "$FILE" >/dev/null 2>&1 || true

exit 0

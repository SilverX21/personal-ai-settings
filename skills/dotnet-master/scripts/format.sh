#!/usr/bin/env bash
# PostToolUse hook (matcher: Edit|Write) — format an edited C# file.
#
# Scope: C# source only, and only when it belongs to a real .NET project. Other languages
# in the repo (TypeScript, SQL, YAML, Dockerfile) are formatted by their own tooling.
#
# Cost: `dotnet format` loads the project through MSBuild, so it is scoped to the file's
# OWNING PROJECT rather than the whole solution, and capped by a timeout so a slow restore
# can never stall the session. Set DOTNET_MASTER_FORMATTER=csharpier for a faster path.
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
. "$DIR/_common.sh"

require_jq
INPUT="$(cat)"
FILE="$(hook_file_path "$INPUT")"

[ -n "$FILE" ] || exit 0
is_csharp_source "$FILE" || exit 0

# A .cs file outside any project (a loose script, a sample) is not ours to reformat.
PROJECT="$(owning_project "$FILE")" || exit 0
[ -n "$PROJECT" ] || exit 0

# `dotnet format` needs a restored project. On a cold tree it would trigger a full
# restore inside a PostToolUse hook — slow, and likely to hit the timeout. Skip instead;
# the next explicit build/format will catch the file.
PROJ_DIR="$(dirname "$PROJECT")"
if [ "${DOTNET_MASTER_FORMATTER:-dotnet-format}" = "dotnet-format" ] \
   && [ ! -f "$PROJ_DIR/obj/project.assets.json" ]; then
  exit 0
fi

# Prefer CSharpier when it is on PATH: per-file, no MSBuild, roughly two orders of
# magnitude faster. Explicit DOTNET_MASTER_FORMATTER always wins.
if [ -z "${DOTNET_MASTER_FORMATTER:-}" ] && dotnet tool list --global 2>/dev/null | grep -q csharpier; then
  DOTNET_MASTER_FORMATTER=csharpier
fi

# Bound the work: a hook that hangs is worse than a file that stays unformatted.
TIMEOUT_BIN=""
command -v timeout  >/dev/null 2>&1 && TIMEOUT_BIN="timeout"
command -v gtimeout >/dev/null 2>&1 && TIMEOUT_BIN="gtimeout"
run() { if [ -n "$TIMEOUT_BIN" ]; then "$TIMEOUT_BIN" 60 "$@"; else "$@"; fi; }

case "${DOTNET_MASTER_FORMATTER:-dotnet-format}" in
  csharpier)
    # Per-file, no MSBuild — much faster when the project is large.
    run dotnet csharpier "$FILE" >/dev/null 2>&1 || true
    ;;
  none)
    ;;
  *)
    run dotnet format "$PROJECT" --include "$FILE" --verbosity quiet >/dev/null 2>&1 || true
    ;;
esac

exit 0

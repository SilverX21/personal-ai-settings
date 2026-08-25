#!/usr/bin/env bash
# PostToolUse hook (matcher: Edit|Write) — auto-format edited C# files.
# Default: dotnet format (matches your skill). For a faster per-file hook, swap to CSharpier (Option B).
set -uo pipefail

INPUT="$(cat)"
FILE="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty')"

# Only touch C# files that exist.
case "$FILE" in
  *.cs) ;;
  *) exit 0 ;;
esac
[ -f "$FILE" ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# --- Option A: dotnet format (default; SDK built-in, slower because it spins up MSBuild) ---
dotnet format --include "$FILE" >/dev/null 2>&1 || true

# --- Option B: CSharpier (much faster per-file; comment out Option A and uncomment this) ---
# dotnet csharpier "$FILE" >/dev/null 2>&1 || true

exit 0

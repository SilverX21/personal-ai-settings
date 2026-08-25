#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash|Read|Edit|Write)
#  - Bash: hard-deny clearly destructive commands; ASK before an EF migration to a prod/remote DB.
#  - Read/Edit/Write: deny touching secret files.
# Emits a PreToolUse permissionDecision as JSON, or exits 0 (no opinion → normal permission flow).
set -uo pipefail

INPUT="$(cat)"
TOOL="$(printf '%s' "$INPUT" | jq -r '.tool_name // empty')"

deny() { jq -n --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'; exit 0; }
ask()  { jq -n --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"ask", permissionDecisionReason:$r}}'; exit 0; }

# ----------------------------- Customize these -----------------------------
# Connection-string / environment hints that mean "not local dev".
PROD_PATTERN='Production|amazonaws\.com|\.rds\.|database\.azure\.com|neon\.tech|supabase\.co|postgres\.database\.azure\.com'
# Files Claude should never read or write.
SECRET_PATTERN='(^|/)\.env($|\.)|\.pem$|\.pfx$|\.p12$|\.key$|(^|/)id_rsa|(^|/)secrets\.json$'
# ---------------------------------------------------------------------------

case "$TOOL" in
  Bash)
    CMD="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')"

    # Hard deny — destructive commands.
    if printf '%s' "$CMD" | grep -Eq 'rm +-rf +(/|~|\$HOME)|git +push +[^|]*--force[^|]*\b(main|master)\b|DROP +(TABLE|DATABASE)'; then
      deny "Destructive command blocked by guard hook: $CMD"
    fi

    # Ask — EF Core migration that looks non-local / prod.
    if printf '%s' "$CMD" | grep -Eq 'ef +database +update'; then
      if printf '%s' "$CMD" | grep -Eq "$PROD_PATTERN"; then
        ask "This runs an EF Core migration against what looks like a production/remote database:"$'\n'"$CMD"$'\n'"Apply it?"
      fi
    fi
    exit 0
    ;;
  Read|Edit|Write)
    FILE="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty')"
    [ -n "$FILE" ] || exit 0
    if printf '%s' "$FILE" | grep -Eq "$SECRET_PATTERN"; then
      deny "Blocked access to a secret file: $FILE — handle secrets via a secret store, not in-session."
    fi
    exit 0
    ;;
  *)
    exit 0
    ;;
esac

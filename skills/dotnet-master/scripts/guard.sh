#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash|Read|Edit|Write)
#   - Bash: hard-deny clearly destructive commands; ASK before an EF migration to a remote DB.
#   - Read/Edit/Write: deny touching secret-bearing files.
#
# SCOPE NOTE: this is a SAFETY guard, not a .NET analyzer. Unlike format.sh and
# lint-antipatterns.sh — which are strictly C#-only — the secret-file check deliberately
# applies to every file type, because a leaked .pem is a leaked .pem in any language.
# It analyzes nothing and modifies nothing; it only blocks.
#
# Emits a PreToolUse permissionDecision as JSON, or exits 0 (no opinion → normal flow).
set -uo pipefail

command -v jq >/dev/null 2>&1 || exit 0   # fail open: never break the session

INPUT="$(cat)"
TOOL="$(printf '%s' "$INPUT" | jq -r '.tool_name // empty')"

deny() { jq -n --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'; exit 0; }
ask()  { jq -n --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"ask", permissionDecisionReason:$r}}'; exit 0; }

# ----------------------------- Customize these -----------------------------
# Connection-string / host hints that mean "not a local dev database".
REMOTE_DB_PATTERN='Production|amazonaws\.com|\.rds\.|database\.azure\.com|neon\.tech|supabase\.co'
# Files that carry real secrets and must never be read or written in-session.
SECRET_PATTERN='(^|/)\.env($|\.local$|\.production$|\.prod$)|\.pem$|\.pfx$|\.p12$|\.key$|(^|/)id_rsa|(^|/)secrets\.json$'
# Templates that only document which variables exist — safe and often necessary to read.
SECRET_ALLOW_PATTERN='\.(example|sample|template|dist)$|(^|/)\.env\.example$'
# ---------------------------------------------------------------------------

case "$TOOL" in
  Bash)
    CMD="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')"
    [ -n "$CMD" ] || exit 0

    # Hard deny — recursive force-delete of a root-ish path (covers -rf, -fr, -r -f).
    if printf '%s' "$CMD" | grep -Eq 'rm +(-[a-zA-Z]* )*-[a-zA-Z]*[rR][a-zA-Z]*f|rm +(-[a-zA-Z]* )*-[a-zA-Z]*f[a-zA-Z]*[rR]' \
       && printf '%s' "$CMD" | grep -Eq 'rm +[^|;]*(/|~|\$HOME|\*) *($|;|&|\|)'; then
      deny "Destructive recursive delete blocked by dotnet-master guard: $CMD"
    fi

    # Hard deny — force-push to a protected branch.
    if printf '%s' "$CMD" | grep -Eq 'git +push +[^|;]*--force([^-]|$)[^|;]*\b(main|master)\b|git +push +[^|;]*-f\b[^|;]*\b(main|master)\b'; then
      deny "Force-push to a protected branch blocked by dotnet-master guard: $CMD"
    fi

    # Hard deny — destructive SQL actually being executed (not merely grepped for).
    if printf '%s' "$CMD" | grep -Eqi '(psql|sqlcmd|mysql|dotnet +ef)[^|;]*(DROP +(TABLE|DATABASE|SCHEMA)|TRUNCATE +TABLE)'; then
      deny "Destructive SQL blocked by dotnet-master guard: $CMD"
    fi

    # Ask — EF Core migration or drop against what looks like a remote/production DB.
    if printf '%s' "$CMD" | grep -Eq 'dotnet +ef +database +(update|drop)'; then
      if printf '%s' "$CMD" | grep -Eq "$REMOTE_DB_PATTERN"; then
        ask "This targets what looks like a production/remote database:"$'\n'"$CMD"$'\n'"Apply it?"
      fi
    fi
    exit 0
    ;;

  Read|Edit|Write)
    FILE="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty')"
    [ -n "$FILE" ] || exit 0
    # Templates first — .env.example documents variable names, it holds no secrets.
    if printf '%s' "$FILE" | grep -Eq "$SECRET_ALLOW_PATTERN"; then
      exit 0
    fi
    if printf '%s' "$FILE" | grep -Eq "$SECRET_PATTERN"; then
      deny "Blocked access to a secret-bearing file: $FILE — use a secret store (User Secrets locally, a managed vault in prod)."
    fi
    exit 0
    ;;

  *)
    exit 0
    ;;
esac

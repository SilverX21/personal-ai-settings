#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash|Read|Edit|Write)
#   - Bash: deny commands that bypass human review; ASK before anything that mutates
#           live infrastructure or state.
#   - Read/Edit/Write: deny touching state files and secret-bearing files.
#
# SCOPE NOTE: this is a SAFETY guard, not a Terraform analyzer. The state-file and
# secret-file checks apply to every file type, because a leaked .tfstate is a leaked
# credential store regardless of what else is in the repo. It analyzes nothing and
# modifies nothing; it only blocks.
#
# Emits a PreToolUse permissionDecision as JSON, or exits 0 (no opinion → normal flow).
set -uo pipefail

command -v jq >/dev/null 2>&1 || exit 0   # fail open: never break the session

INPUT="$(cat)"
TOOL="$(printf '%s' "$INPUT" | jq -r '.tool_name // empty')"

deny() { jq -n --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'; exit 0; }
ask()  { jq -n --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"ask", permissionDecisionReason:$r}}'; exit 0; }

# ----------------------------- Customize these -----------------------------
# State files hold every managed value in plaintext, secrets included.
STATE_PATTERN='\.tfstate($|\.backup$)|(^|/)\.terraform/'
# Files that carry real secrets and must never be read or written in-session.
SECRET_PATTERN='(^|/)\.env($|\.local$|\.production$|\.prod$)|\.pem$|\.pfx$|\.p12$|\.key$|(^|/)id_rsa|(^|/)secrets\.(json|auto\.tfvars)$'
# Templates that only document which variables exist — safe and often necessary to read.
SECRET_ALLOW_PATTERN='\.(example|sample|template|dist)$|(^|/)\.env\.example$|\.tfvars\.example$'
# ---------------------------------------------------------------------------

# Matches `terraform`, `tofu`, and `terragrunt` as the invoked binary.
TF='(terraform|tofu|terragrunt)'

case "$TOOL" in
  Bash)
    CMD="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')"
    [ -n "$CMD" ] || exit 0

    # Hard deny — auto-approve bypasses the plan review that every control depends on.
    # A merged pipeline applies a saved plan file; it does not need this flag here.
    if printf '%s' "$CMD" | grep -Eq "\b$TF\b[^|;]*\b(apply|destroy)\b[^|;]*--?auto-approve"; then
      deny "\`-auto-approve\` blocked by aws-terraform-master guard: $CMD
Applying without a reviewed plan defeats the review gate. Run \`plan -out=tfplan\`, show it, then apply the saved plan file."
    fi

    # Hard deny — force-unlock discards another run's lock and can corrupt state.
    if printf '%s' "$CMD" | grep -Eq "\b$TF\b[^|;]*\bforce-unlock\b"; then
      deny "\`force-unlock\` blocked by aws-terraform-master guard: $CMD
This discards a lock another run may still hold. Confirm the other run is dead, then a human should run it directly."
    fi

    # Ask — destroys live infrastructure.
    if printf '%s' "$CMD" | grep -Eq "\b$TF\b[^|;]*\bdestroy\b"; then
      ask "This DESTROYS live infrastructure:"$'\n'"$CMD"$'\n\n'"Proceed?"
    fi

    # Ask — mutates live infrastructure.
    if printf '%s' "$CMD" | grep -Eq "\b$TF\b[^|;]*\bapply\b"; then
      ask "This applies changes to live infrastructure:"$'\n'"$CMD"$'\n\n'"Proceed?"
    fi

    # Ask — mutates state directly. Invisible to review; prefer moved/import blocks.
    if printf '%s' "$CMD" | grep -Eq "\b$TF\b[^|;]*\bstate +(rm|mv|push|replace-provider)\b"; then
      ask "This edits Terraform state directly:"$'\n'"$CMD"$'\n\n'"Prefer a \`moved\` block — refactoring belongs in the diff. Proceed anyway?"
    fi

    # Ask — taint/untaint and CLI import both change what the next apply will do.
    if printf '%s' "$CMD" | grep -Eq "\b$TF\b[^|;]*\b(taint|untaint|import)\b"; then
      ask "This changes what the next apply will do:"$'\n'"$CMD"$'\n\n'"For imports, prefer an \`import\` block so the plan shows it. Proceed?"
    fi

    # ---------------------------- AWS CLI ----------------------------------
    # Investigation must stay free; mutation must not happen outside Terraform.
    # Anything the CLI changes directly becomes drift the next apply reverts.
    if printf '%s' "$CMD" | grep -Eq '(^[[:space:]]*|[|;&][[:space:]]*)aws[[:space:]]'; then

      # Read-only verbs — allow silently. Listed explicitly rather than by
      # exclusion, so an unrecognised verb falls through to `ask` and never
      # runs unreviewed.
      if printf '%s' "$CMD" | grep -Eq '(^[[:space:]]*|[|;&][[:space:]]*)aws[[:space:]]+[a-z0-9-]+[[:space:]]+(describe|get|list|lookup|search|scan|batch-get|head|test|simulate|filter|estimate|preview|validate|check|generate-credential-report|tail|start-query|stop-query|get-query-results|select|sample|summarize|export-|analyze|query)([a-z0-9-]*)?\b'; then
        exit 0
      fi

      # `aws logs tail` and `aws s3 ls`/`cp` do not follow the verb-first shape.
      if printf '%s' "$CMD" | grep -Eq '(^[[:space:]]*|[|;&][[:space:]]*)aws[[:space:]]+logs[[:space:]]+tail\b|(^[[:space:]]*|[|;&][[:space:]]*)aws[[:space:]]+s3[[:space:]]+ls\b|(^[[:space:]]*|[|;&][[:space:]]*)aws[[:space:]]+sts[[:space:]]+get-caller-identity\b|(^[[:space:]]*|[|;&][[:space:]]*)aws[[:space:]]+(configure[[:space:]]+list|--version)\b'; then
        exit 0
      fi

      # Hard deny — irreversible destruction of live resources. The fix for a
      # resource that should not exist is to remove it from the code and apply.
      if printf '%s' "$CMD" | grep -Eq '(^[[:space:]]*|[|;&][[:space:]]*)aws[[:space:]]+[a-z0-9-]+[[:space:]]+(delete|terminate|remove|purge|destroy|deregister|revoke|disable|cancel|reset|restore)[a-z0-9-]*\b'; then
        deny "Destructive AWS CLI call blocked by aws-terraform-master guard:
$CMD

Deleting a Terraform-managed resource by CLI desynchronises state and the change is invisible to review. Remove it from the configuration and apply instead.
If this is genuinely out-of-band emergency work, run it yourself in the terminal."
      fi

      # Ask — everything else that touches AWS. Includes create/update/put/
      # modify/start/stop/run/invoke/attach/scale, plus any verb not matched
      # above, because an unknown verb is not assumed safe.
      ask "This AWS CLI call may change live infrastructure:"$'\n'"$CMD"$'\n\n'"Changes made outside Terraform become drift that the next apply reverts. Proceed?"
    fi

    exit 0
    ;;

  Read|Edit|Write)
    FILE="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty')"
    [ -n "$FILE" ] || exit 0

    # Templates first — .tfvars.example documents variable names, it holds no secrets.
    if printf '%s' "$FILE" | grep -Eq "$SECRET_ALLOW_PATTERN"; then
      exit 0
    fi
    if printf '%s' "$FILE" | grep -Eq "$STATE_PATTERN"; then
      deny "Blocked access to Terraform state: $FILE
State holds every managed value in plaintext, secrets included, and hand-editing it corrupts infrastructure. Use \`terraform state show\` for inspection, \`moved\`/\`import\` blocks for changes."
    fi
    if printf '%s' "$FILE" | grep -Eq "$SECRET_PATTERN"; then
      deny "Blocked access to a secret-bearing file: $FILE — use AWS Secrets Manager or SSM Parameter Store, and write-only arguments in Terraform."
    fi
    exit 0
    ;;

  *)
    exit 0
    ;;
esac

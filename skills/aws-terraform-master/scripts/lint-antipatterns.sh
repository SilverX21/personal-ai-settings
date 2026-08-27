#!/usr/bin/env bash
# PostToolUse hook (matcher: Edit|Write) — flag banned patterns in an edited Terraform
# file and feed the findings back so they get fixed. Detection only; the file already
# changed.
#
# Scope: .tf and .tfvars only. Never inspects YAML, Python, Go, Dockerfiles or any other
# language an infrastructure repo may contain, and never inspects .terraform/ or state.
#
# Every rule here is chosen to be line-oriented and low-false-positive. A noisy hook
# gets disabled, and a disabled hook catches nothing.
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
. "$DIR/_common.sh"

require_jq
INPUT="$(cat)"
FILE="$(hook_file_path "$INPUT")"

[ -n "$FILE" ] || exit 0
is_terraform_source "$FILE" || exit 0

SRC="$(strip_comments "$FILE")"
findings=""
add() { findings+="- $1"$'\n'; }

# --- State and backend -------------------------------------------------------
# DynamoDB locking is deprecated since Terraform 1.10; S3 locks natively.
if rule_enabled dynamodb_lock && printf '%s' "$SRC" | grep -Eq '^[[:space:]]*dynamodb_table[[:space:]]*='; then
  add "\`dynamodb_table\` in the backend: DynamoDB state locking is DEPRECATED since Terraform 1.10 and will be removed. Use \`use_lockfile = true\` instead."
fi

# A backend block with no locking mechanism at all.
if rule_enabled backend_lock && printf '%s' "$SRC" | grep -Eq 'backend[[:space:]]+"s3"'; then
  if ! printf '%s' "$SRC" | grep -Eq '^[[:space:]]*(use_lockfile|dynamodb_table)[[:space:]]*='; then
    add "S3 backend without state locking. Add \`use_lockfile = true\` — concurrent applies corrupt state, and there is no clean recovery."
  fi
  if ! printf '%s' "$SRC" | grep -Eq '^[[:space:]]*encrypt[[:space:]]*=[[:space:]]*true'; then
    add "S3 backend without \`encrypt = true\`. State holds every managed value in plaintext."
  fi
fi

# --- Secrets -----------------------------------------------------------------
# A literal assigned to a password/secret/token field. Ignores var./local./data./ephemeral.
if rule_enabled hardcoded_secret \
   && printf '%s' "$SRC" | grep -Eiq '^[[:space:]]*(password|secret|secret_string|token|api_key|access_key|secret_key|private_key)[[:space:]]*=[[:space:]]*"[^"]{6,}"'; then
  add "Hardcoded secret literal. Never commit secrets to .tf/.tfvars — use AWS Secrets Manager or SSM, and a write-only (\`*_wo\`) argument so it never reaches state."
fi

# random_password without a write-only argument lands in state in plaintext.
if rule_enabled password_in_state \
   && printf '%s' "$SRC" | grep -Eq 'resource[[:space:]]+"random_password"' \
   && ! printf '%s' "$SRC" | grep -Eq '_wo(_version)?[[:space:]]*='; then
  add "\`random_password\` without a write-only argument: the generated value is stored in state in plaintext. Pair it with an \`ephemeral\` block and a \`*_wo\` argument (Terraform 1.11+)."
fi

# --- IAM ---------------------------------------------------------------------
if rule_enabled wildcard_iam \
   && printf '%s' "$SRC" | grep -Eq '^[[:space:]]*actions[[:space:]]*=[[:space:]]*\[[[:space:]]*"\*"[[:space:]]*\]|"Action"[[:space:]]*:[[:space:]]*"\*"'; then
  add "Wildcard IAM action (\`\"*\"\`). Start from an empty policy and add only what fails — least privilege is not optional at a trust boundary."
fi

if rule_enabled heredoc_policy \
   && printf '%s' "$SRC" | grep -Eq '^[[:space:]]*(policy|assume_role_policy|inline_policy)[[:space:]]*=[[:space:]]*<<'; then
  add "Heredoc JSON IAM policy. Use \`data \"aws_iam_policy_document\"\` — you get validation, interpolation checking, and readable diffs."
fi

# --- Module hygiene ----------------------------------------------------------
if rule_enabled unpinned_module \
   && printf '%s' "$SRC" | grep -Eq '^[[:space:]]*source[[:space:]]*=[[:space:]]*"(git::|github\.com|https://)[^"]*"' \
   && printf '%s' "$SRC" | grep -Eq '^[[:space:]]*source[[:space:]]*=[[:space:]]*"[^"]*(\?ref=(main|master)"|[^?]*")[[:space:]]*$'; then
  if ! printf '%s' "$SRC" | grep -Eq '\?ref=[0-9a-fv]'; then
    add "Remote module source pinned to a branch or not pinned at all. Pin to a commit hash (or a version tag) — otherwise your infrastructure changes when someone else merges."
  fi
fi

# A provider block inside a reusable module breaks reuse, multi-region and destroy.
if rule_enabled module_provider && is_module_file "$FILE" \
   && printf '%s' "$SRC" | grep -Eq '^[[:space:]]*provider[[:space:]]+"[a-z]'; then
  add "\`provider\` block inside a module. Modules inherit providers from their caller; declaring one breaks reuse, multi-region, and \`terraform destroy\`. Keep only \`required_providers\`."
fi

# --- Drift and escape hatches ------------------------------------------------
if rule_enabled ignore_changes_all \
   && printf '%s' "$SRC" | grep -Eq 'ignore_changes[[:space:]]*=[[:space:]]*all'; then
  add "\`ignore_changes = all\` permanently blinds Terraform to drift on this resource. Scope it to specific attributes, with a comment saying why."
fi

if rule_enabled provisioner \
   && printf '%s' "$SRC" | grep -Eq '^[[:space:]]*provisioner[[:space:]]+"(local|remote)-exec"'; then
  add "\`provisioner\` block. Terraform does not track what a script did — it is invisible to plan, state and destroy, and will not re-run. Use a real resource or data source."
fi

# --- Cost --------------------------------------------------------------------
if rule_enabled log_retention \
   && printf '%s' "$SRC" | grep -Eq 'resource[[:space:]]+"aws_cloudwatch_log_group"' \
   && ! printf '%s' "$SRC" | grep -Eq '^[[:space:]]*retention_in_days[[:space:]]*='; then
  add "\`aws_cloudwatch_log_group\` without \`retention_in_days\`. The default is NEVER EXPIRE, which quietly becomes a top-ten line item."
fi

# --- Network exposure --------------------------------------------------------
if rule_enabled open_admin_port \
   && printf '%s' "$SRC" | grep -Eq '0\.0\.0\.0/0' \
   && printf '%s' "$SRC" | grep -Eq '(from_port|to_port)[[:space:]]*=[[:space:]]*(22|3389)\b'; then
  add "SSH (22) or RDP (3389) potentially open to 0.0.0.0/0. Use SSM Session Manager instead of exposing an admin port to the internet."
fi

[ -n "$findings" ] || exit 0

msg="aws-terraform-master findings in $FILE:"$'\n'"$findings"
msg+=$'\n'"See references/antipatterns.md. Fix these before continuing, or set TF_MASTER_SKIP_RULES to opt a rule out for this project."
jq -n --arg r "$msg" '{decision: "block", reason: $r}'
exit 0

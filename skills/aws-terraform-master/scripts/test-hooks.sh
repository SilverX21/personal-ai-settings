#!/usr/bin/env bash
# Regression suite for the aws-terraform-master hooks.
#
# Run it after touching guard.sh, lint-antipatterns.sh, format.sh or _common.sh:
#     ./scripts/test-hooks.sh
#
# Exits non-zero on any failure, so it works as a pre-commit or CI gate.
#
# These are the cases that actually caught bugs during development — in particular
# `grep -r aws ./docs`, which an earlier guard matched as an AWS CLI call because the
# pattern did not require `aws` to be in invoked-binary position.
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GUARD="$DIR/guard.sh"
LINT="$DIR/lint-antipatterns.sh"
FORMAT="$DIR/format.sh"

command -v jq >/dev/null 2>&1 || { echo "jq required to run these tests"; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0; fail=0
ok()   { pass=$((pass+1)); printf '  \033[32mok\033[0m   %s\n' "$1"; }
bad()  { fail=$((fail+1)); printf '  \033[31mFAIL\033[0m %s\n     %s\n' "$1" "$2"; }
head_() { printf '\n\033[1m%s\033[0m\n' "$1"; }

# --- guard.sh: Bash commands -------------------------------------------------
# want = deny | ask | allow
g() {
  local want="$1" cmd="$2"
  local got
  got="$(jq -nc --arg c "$cmd" '{tool_name:"Bash",tool_input:{command:$c}}' \
         | "$GUARD" | jq -r '.hookSpecificOutput.permissionDecision // empty')"
  got="${got:-allow}"
  [ "$got" = "$want" ] && ok "$cmd → $got" || bad "$cmd" "got=$got want=$want"
}

# --- guard.sh: file access ---------------------------------------------------
f() {
  local want="$1" tool="$2" path="$3"
  local got
  got="$(jq -nc --arg t "$tool" --arg p "$path" '{tool_name:$t,tool_input:{file_path:$p}}' \
         | "$GUARD" | jq -r '.hookSpecificOutput.permissionDecision // empty')"
  got="${got:-allow}"
  [ "$got" = "$want" ] && ok "$tool $path → $got" || bad "$tool $path" "got=$got want=$want"
}

head_ "guard.sh — Terraform commands"
g deny  'terraform apply -auto-approve'
g deny  'terraform destroy --auto-approve'
g deny  'terraform force-unlock 1234'
g ask   'terraform destroy'
g ask   'terraform apply tfplan'
g ask   'terraform state rm aws_s3_bucket.x'
g ask   'terraform state mv a b'
g ask   'terraform import aws_s3_bucket.x bucket'
g ask   'tofu apply'
g ask   'terragrunt apply'
g allow 'terraform plan -out=tfplan'
g allow 'terraform fmt -recursive -check'
g allow 'terraform validate'
g allow 'terraform init -backend=false'
g allow 'terraform providers lock -platform=linux_amd64'

head_ "guard.sh — AWS CLI read-only (investigation must stay friction-free)"
g allow 'aws ecs describe-tasks --cluster c --tasks arn'
g allow 'aws ecs list-tasks --cluster c --desired-status STOPPED'
g allow 'aws logs tail /ecs/svc --follow'
g allow 'aws logs start-query --log-group-names x'
g allow 'aws logs get-query-results --query-id q'
g allow 'aws sts get-caller-identity'
g allow 'aws cloudtrail lookup-events --max-items 20'
g allow 'aws elbv2 describe-target-health --target-group-arn a'
g allow 'aws ec2 describe-security-groups --group-ids sg-1'
g allow 'aws lambda get-function-configuration --function-name f'
g allow 'aws iam simulate-principal-policy --action-names s3:GetObject'
g allow 'aws s3 ls s3://bucket'

head_ "guard.sh — AWS CLI destructive"
g deny  'aws ecs delete-service --service x'
g deny  'aws ec2 terminate-instances --instance-ids i-1'
g deny  'aws rds delete-db-instance --db-instance-identifier x'
g deny  'aws ec2 revoke-security-group-ingress --group-id sg-1'
g deny  'ls && aws ecs delete-service --service x'          # chained still caught

head_ "guard.sh — AWS CLI mutating, and unknown verbs"
g ask   'aws ecs update-service --force-new-deployment'
g ask   'aws lambda invoke --function-name f out.json'
g ask   'aws ssm put-parameter --name x --value y'
g ask   'aws ec2 create-tags --resources i-1'
g ask   'aws ec2 frobnicate-widget --id x'                  # unknown ≠ safe

head_ "guard.sh — 'aws'/'terraform' as an argument, not the binary (regression)"
# These are the cases that caught real bugs. `rg "terraform destroy" README.md`
# was matched as an actual destroy before the patterns required invoked-binary
# position; `grep -r aws ./docs` was matched as an AWS CLI call for the same reason.
g allow 'grep -r aws ./docs'
g allow 'echo aws delete-service'
g allow 'cat notes.md | grep aws'
g allow 'rg "terraform destroy" README.md'
g allow 'echo "run terraform apply later"'
g allow 'cat docs/runbook.md | grep "aws ecs delete-service"'
g allow 'ls /opt/aws'

head_ "guard.sh — wrappers and prefixes must NOT open a hole"
# Anchoring to invoked-binary position must not let a wrapped command slip past.
g ask   'TF_LOG=debug terraform apply'
g ask   'cd infra && terraform apply'
g ask   'cd infra; terraform destroy'
g ask   'sudo aws ecs update-service'
g deny  'AWS_PROFILE=prod aws ecs delete-service --service x'
g deny  'cd infra && terraform apply -auto-approve'

head_ "guard.sh — file access"
f deny  Read  /repo/terraform.tfstate
f deny  Read  /repo/terraform.tfstate.backup
f deny  Read  /repo/.terraform/modules.json
f deny  Write /repo/terraform.tfstate
f deny  Read  /home/u/.ssh/id_rsa
f deny  Read  /repo/cert.pem
f allow Read  /repo/main.tf
f allow Read  /repo/prod.tfvars.example
f allow Read  /repo/.env.example
f allow Write /repo/modules/vpc/variables.tf

# --- lint-antipatterns.sh ----------------------------------------------------
# Returns the finding count for a file's content.
lint_count() {
  local path="$1"
  jq -nc --arg p "$path" '{tool_name:"Write",tool_input:{file_path:$p}}' \
    | "$LINT" | jq -r '.reason // ""' | grep -c '^- ' || true
}

head_ "lint-antipatterns.sh"

# NOTE: the linter is line-anchored, so this fixture must be `terraform fmt`-style
# with one attribute per line. That is what the linter actually sees in practice,
# because format.sh runs `fmt` on every write. A fixture written with inline
# one-liners (`statement { actions = ["*"] }`) silently under-reports.
mkdir -p "$TMP/modules"
cat > "$TMP/modules/bad.tf" <<'EOF'
terraform {
  backend "s3" {
    bucket         = "x"
    dynamodb_table = "tf-locks"
  }
}

provider "aws" {
  region = "eu-west-1"
}

resource "random_password" "db" {
  length = 16
}

resource "aws_db_instance" "this" {
  password = "hunter2supersecret"
}

data "aws_iam_policy_document" "bad" {
  statement {
    actions = ["*"]
  }
}

resource "aws_iam_role" "r" {
  assume_role_policy = <<EOT
{}
EOT
}

module "vpc" {
  source = "github.com/terraform-aws-modules/terraform-aws-vpc.git?ref=main"
}

resource "aws_cloudwatch_log_group" "lg" {
  name = "app"
}

resource "aws_security_group_rule" "ssh" {
  from_port   = 22
  cidr_blocks = ["0.0.0.0/0"]
}

resource "aws_instance" "i" {
  lifecycle {
    ignore_changes = all
  }
  provisioner "local-exec" {
    command = "echo hi"
  }
}
EOF
n="$(lint_count "$TMP/modules/bad.tf")"
[ "$n" -ge 12 ] && ok "bad.tf → $n findings (expected ≥12)" \
                || bad "bad.tf" "got $n findings, expected ≥12"

# A clean file must produce ZERO findings. A noisy linter gets disabled, and a
# disabled linter catches nothing — this is the most important test here.
cat > "$TMP/good.tf" <<'EOF'
# Decoy comment: provisioner "local-exec" and ignore_changes = all and actions = ["*"]
terraform {
  backend "s3" {
    bucket       = "acme-tfstate-prod"
    encrypt      = true
    use_lockfile = true
  }
}
provider "aws" {
  default_tags { tags = { ManagedBy = "terraform" } }
}
ephemeral "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id
}
resource "aws_db_instance" "this" {
  password_wo         = ephemeral.aws_secretsmanager_secret_version.db.secret_string
  password_wo_version = var.db_password_version
}
data "aws_iam_policy_document" "scoped" {
  statement {
    actions   = ["s3:GetObject"]
    resources = [aws_s3_bucket.this.arn]
  }
}
module "vpc" {
  source = "github.com/terraform-aws-modules/terraform-aws-vpc.git?ref=8bbc07e" # v5.13.0
}
resource "aws_cloudwatch_log_group" "lg" {
  name              = "app"
  retention_in_days = 30
}
resource "aws_instance" "i" {
  lifecycle { ignore_changes = [tags["LastScanned"]] }
}
EOF
n="$(lint_count "$TMP/good.tf")"
[ "$n" -eq 0 ] && ok "good.tf → 0 findings (no false positives)" \
               || bad "good.tf" "got $n false positives, expected 0"

# Scope: never inspect another language.
printf 'password = "hunter2supersecret"\n' > "$TMP/notours.yml"
n="$(lint_count "$TMP/notours.yml")"
[ "$n" -eq 0 ] && ok "notours.yml → ignored (non-Terraform)" \
               || bad "notours.yml" "inspected a non-Terraform file"

# Opt-out honoured.
n="$(TF_MASTER_SKIP_RULES=dynamodb_lock,backend_lock,hardcoded_secret,password_in_state,wildcard_iam,heredoc_policy,unpinned_module,module_provider,ignore_changes_all,provisioner,open_admin_port,log_retention \
     lint_count "$TMP/modules/bad.tf")"
[ "$n" -eq 0 ] && ok "TF_MASTER_SKIP_RULES silences every rule" \
               || bad "TF_MASTER_SKIP_RULES" "got $n findings, expected 0"

# --- format.sh ---------------------------------------------------------------
head_ "format.sh"

# Must exit 0 and never hang, whether or not a terraform binary exists.
printf 'resource "aws_s3_bucket" "this" {\nbucket="x"\n}\n' > "$TMP/messy.tf"
if jq -nc --arg p "$TMP/messy.tf" '{tool_name:"Write",tool_input:{file_path:$p}}' \
   | "$FORMAT" >/dev/null 2>&1; then
  ok "exits 0 on a .tf file"
else
  bad "format.sh" "non-zero exit on a .tf file"
fi

if TF_MASTER_FORMATTER=none jq -nc --arg p "$TMP/notours.yml" \
     '{tool_name:"Write",tool_input:{file_path:$p}}' | "$FORMAT" >/dev/null 2>&1; then
  ok "exits 0 and skips a non-Terraform file"
else
  bad "format.sh" "non-zero exit on a non-Terraform file"
fi

if command -v terraform >/dev/null 2>&1 || command -v tofu >/dev/null 2>&1; then
  jq -nc --arg p "$TMP/messy.tf" '{tool_name:"Write",tool_input:{file_path:$p}}' \
    | "$FORMAT" >/dev/null 2>&1
  if grep -q 'bucket = "x"' "$TMP/messy.tf"; then
    ok "actually reformatted the file"
  else
    bad "format.sh" "file was not reformatted despite a formatter being present"
  fi
else
  printf '  \033[33mskip\033[0m no terraform/tofu binary — formatting not exercised\n'
fi

# --- result ------------------------------------------------------------------
printf '\n\033[1m%d passed, %d failed\033[0m\n' "$pass" "$fail"
[ "$fail" -eq 0 ]

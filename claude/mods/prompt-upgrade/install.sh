#!/usr/bin/env bash
# Install the prompt-upgrade mod from this repo's folder marketplace (nuno-mods).
# Idempotent. A nuno-mods marketplace that reads from another folder is re-pointed
# here, since a folder marketplace is read in place and two cannot share the name.
# Other mods from the old marketplace are reinstalled, but their saved options reset.
#
#   ./claude/mods/prompt-upgrade/install.sh
set -euo pipefail

MOD="prompt-upgrade"
MARKET="nuno-mods"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

info() { printf '  %s\n' "$*"; }
warn() { printf '  !! %s\n' "$*" >&2; }

command -v claude >/dev/null 2>&1 || { warn "claude CLI not found: install Claude Code first"; exit 1; }
[ -f "$REPO/.claude-plugin/marketplace.json" ] || { warn "no marketplace.json in $REPO"; exit 1; }

# Paths are compared resolved, since $REPO may reach the repo through a symlink.
current="$(claude plugin marketplace list --json 2>/dev/null | python3 -c '
import json,os,sys
for m in json.load(sys.stdin):
    if m.get("name") == sys.argv[1]: print(os.path.realpath(m.get("path") or m.get("installLocation") or "") or "?")
' "$MARKET" || true)"
wanted="$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$REPO")"

echo "==> Marketplace $MARKET"
if [ -z "$current" ]; then
  claude plugin marketplace add "$REPO" >/dev/null
  info "added    $MARKET -> $REPO"
elif [ "$current" != "$wanted" ]; then
  # Removing the marketplace uninstalls every mod from it, not just this one, so
  # note what was installed (as "name scope enabled") and put it all back after.
  installed="$(claude plugin list --json 2>/dev/null | python3 -c '
import json,sys
for p in json.load(sys.stdin):
    name, _, market = p["id"].partition("@")
    if market == sys.argv[1]: print(name, p.get("scope", "user"), str(p.get("enabled", True)).lower())
' "$MARKET" || true)"
  warn "$MARKET reads from $current; re-pointing it to $REPO (resets these mods' saved options)"
  claude plugin marketplace remove "$MARKET" >/dev/null
  claude plugin marketplace add "$REPO" >/dev/null
  info "added    $MARKET -> $REPO"
  while read -r name scope enabled; do
    [ -n "$name" ] && [ "$name" != "$MOD" ] || continue
    if claude plugin install "$name@$MARKET" --scope "$scope" >/dev/null 2>&1; then
      [ "$enabled" = "true" ] || claude plugin disable "$name@$MARKET" >/dev/null 2>&1 || true
      info "restored $name@$MARKET"
    else
      warn "could not restore $name@$MARKET (not in this repo's marketplace?)"
    fi
  done <<<"$installed"
else
  info "have     $MARKET -> $REPO"
fi

echo "==> Mod $MOD"
if claude plugin install "$MOD@$MARKET" --scope user >/dev/null 2>&1; then
  info "ok       $MOD@$MARKET"
else
  warn "install failed: try  claude plugin install $MOD@$MARKET"
  exit 1
fi

cat <<'NEXT'

Done. In a running session run /reload-plugins, or start a new one. Then:
  /better <rough prompt>   upgrade one prompt
  /better on | off         turn automatic mode on or off
NEXT

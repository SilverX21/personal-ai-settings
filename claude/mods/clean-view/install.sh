#!/usr/bin/env bash
# Install the clean-view mod from this repo's folder marketplace (nuno-mods).
# Idempotent. A nuno-mods marketplace that reads from another folder is re-pointed
# here, since a folder marketplace is read in place and two cannot share the name.
# A standalone copy (clean-view@clean-view-mods) is removed so the mod loads once.
#
#   ./claude/mods/clean-view/install.sh
set -euo pipefail

MOD="clean-view"
MARKET="nuno-mods"
OLD_MARKET="clean-view-mods"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

info() { printf '  %s\n' "$*"; }
warn() { printf '  !! %s\n' "$*" >&2; }

command -v claude >/dev/null 2>&1 || { warn "claude CLI not found: install Claude Code first"; exit 1; }
[ -f "$REPO/.claude-plugin/marketplace.json" ] || { warn "no marketplace.json in $REPO"; exit 1; }

listing="$(claude plugin marketplace list 2>/dev/null || true)"
current="$(printf '%s\n' "$listing" | grep -A1 "❯ $MARKET\$" | sed -n 's/^ *Source: Folder (\(.*\))$/\1/p')"

echo "==> Marketplace $MARKET"
if ! printf '%s\n' "$listing" | grep -q "❯ $MARKET\$"; then
  claude plugin marketplace add "$REPO" >/dev/null
  info "added    $MARKET -> $REPO"
elif [ "$current" != "$REPO" ]; then
  warn "$MARKET reads from ${current:-another source}; re-pointing it to $REPO"
  claude plugin marketplace remove "$MARKET" >/dev/null
  claude plugin marketplace add "$REPO" >/dev/null
  info "added    $MARKET -> $REPO"
else
  info "have     $MARKET -> $REPO"
fi

echo "==> Standalone copy"
if claude plugin list 2>/dev/null | grep -q "❯ $MOD@$OLD_MARKET\$"; then
  claude plugin uninstall "$MOD@$OLD_MARKET" --scope user >/dev/null
  info "removed  $MOD@$OLD_MARKET"
fi
if printf '%s\n' "$listing" | grep -q "❯ $OLD_MARKET\$"; then
  claude plugin marketplace remove "$OLD_MARKET" >/dev/null
  info "removed  marketplace $OLD_MARKET"
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
  /simple          turn Clean View on or off
  /simple on|off   set it either way
NEXT

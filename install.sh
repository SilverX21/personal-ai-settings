#!/usr/bin/env bash
# Wire this repo into ~/.claude as the source of truth, and rehydrate third-party skills.
# Idempotent. Backs up anything real it would replace. Never overwrites settings.json.
#
#   ./install.sh              symlink my stuff + reinstall third-party skills
#   ./install.sh --link-only  symlink only, skip the network
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE="$HOME/.claude"
AGENTS="$HOME/.agents"
STAMP="$(date +%Y%m%d-%H%M%S)"

info() { printf '  %s\n' "$*"; }
warn() { printf '  !! %s\n' "$*" >&2; }

BACKUPS="$CLAUDE/.backups/$STAMP"

# Symlink src -> dest, backing up a real file/dir already sitting there.
# Backups go OUTSIDE ~/.claude/skills — a stale copy left in there still has a
# SKILL.md and would register as a duplicate skill.
link() {
  local src="$1" dest="$2"
  mkdir -p "$(dirname "$dest")"
  if [ -L "$dest" ]; then
    [ "$(readlink "$dest")" = "$src" ] && { info "ok       $dest"; return; }
    rm "$dest"
  elif [ -e "$dest" ]; then
    mkdir -p "$BACKUPS"
    mv "$dest" "$BACKUPS/$(basename "$dest")"
    warn "backed up $(basename "$dest") -> $BACKUPS/"
  fi
  ln -s "$src" "$dest"
  info "linked   $dest"
}

echo "==> Linking authored skills and agents"
for skill in "$REPO"/skills/*/; do
  link "$skill" "$CLAUDE/skills/$(basename "$skill")"
done
for agent in "$REPO"/agents/*.md; do
  link "$agent" "$CLAUDE/agents/$(basename "$agent")"
done

echo "==> Restoring skill lock"
mkdir -p "$AGENTS"
if [ -e "$AGENTS/.skill-lock.json" ] && \
   ! cmp -s "$REPO/third-party/skill-lock.json" "$AGENTS/.skill-lock.json"; then
  cp "$AGENTS/.skill-lock.json" "$AGENTS/.skill-lock.json.bak-$STAMP"
  warn "existing lock differs, backed up"
fi
cp "$REPO/third-party/skill-lock.json" "$AGENTS/.skill-lock.json"
info "ok       $AGENTS/.skill-lock.json"

if [ "${1:-}" = "--link-only" ]; then
  echo "==> Skipping third-party install (--link-only)"
else
  echo "==> Reinstalling third-party skills from manifest"
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT

  # name<TAB>url<TAB>skillPath, one per line
  python3 -c '
import json,sys
m=json.load(open(sys.argv[1]))
for s in m["skills"]:
    print("\t".join([s["name"], s["url"], s["skillPath"]]))
' "$REPO/third-party/manifest.json" | while IFS=$'\t' read -r name url path; do
    dest="$AGENTS/skills/$name"
    [ -e "$dest" ] && { info "have     $name"; continue; }

    # one shallow clone per repo, reused across skills that share it
    clone="$tmp/$(echo "$url" | shasum | cut -c1-12)"
    [ -d "$clone" ] || git clone --depth 1 --quiet "$url" "$clone" 2>/dev/null || {
      warn "clone failed: $name ($url)"; continue; }

    src="$clone/$(dirname "$path")"
    [ -d "$src" ] || { warn "not found in repo: $name -> $path"; continue; }
    mkdir -p "$AGENTS/skills"
    cp -R "$src" "$dest"
    info "fetched  $name"
  done

  echo "==> Linking third-party skills into ~/.claude"
  for skill in "$AGENTS"/skills/*/; do
    name="$(basename "$skill")"
    [ -e "$REPO/skills/$name" ] && continue   # ours wins, already linked above
    link "$skill" "$CLAUDE/skills/$name"
  done
fi

cat <<EOF

==> Manual steps left (deliberately not automated)

  settings.json  Not overwritten — it holds machine-specific absolute paths and
                 your live plugin state. Compare and merge by hand:
                   diff $REPO/config/settings.json $CLAUDE/settings.json

  plugins        Marketplaces + enabled plugins are listed in
                 third-party/manifest.json. Add them with /plugin in Claude Code.

  graphify       CLI-managed, not vendored. Check: which graphify

Done.
EOF

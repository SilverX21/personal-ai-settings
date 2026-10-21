#!/usr/bin/env bash
# Wire this repo into ~/.claude as the source of truth, and rehydrate third-party skills.
# Idempotent. Backs up anything real it would replace. Never overwrites settings.json.
#
#   ./install.sh              symlink my stuff + reinstall third-party skills
#   ./install.sh --link-only  symlink only, skip the network
#
# Also points core.hooksPath at .githooks so the cspell pre-commit gate is live.
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

echo "==> Enabling repo git hooks"
if [ -d "$REPO/.git" ]; then
  git -C "$REPO" config core.hooksPath .githooks
  info "ok       core.hooksPath -> .githooks"
else
  warn "not a git checkout, skipped core.hooksPath"
fi

echo "==> Installing my mods (this repo is a folder marketplace)"
# A folder marketplace is read in place: git pull + /reload-plugins updates them, no reinstall.
# Work-specific mod options live in ~/.claude/settings.json -> pluginConfigs, never in this repo.
install_mods() {
  python3 -c '
import json,sys
for p in json.load(open(sys.argv[1]))["plugins"]: print(p["name"])
' "$REPO/.claude-plugin/marketplace.json" | while read -r mod; do
    if claude plugin install "$mod@nuno-mods" >/dev/null 2>&1; then
      info "ok       $mod@nuno-mods"
    else
      warn "install failed: $mod@nuno-mods (try: claude plugin install $mod@nuno-mods)"
    fi
  done
}

if command -v claude >/dev/null 2>&1; then
  # Existence alone isn't enough: a mod's own install script once registered
  # "nuno-mods" pointing at its own folder, which hid every other mod here.
  # Paths are compared resolved, since $REPO may reach the repo through a symlink.
  current="$(claude plugin marketplace list --json 2>/dev/null | python3 -c '
import json,os,sys
for m in json.load(sys.stdin):
    if m.get("name") == "nuno-mods": print(os.path.realpath(m.get("path") or m.get("installLocation") or ""))
' || true)"
  wanted="$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$REPO")"
  if [ -z "$current" ]; then
    claude plugin marketplace add "$REPO" >/dev/null && info "added    marketplace nuno-mods"
    install_mods
  elif [ "$current" = "$wanted" ]; then
    info "have     marketplace nuno-mods"
    install_mods
  else
    # Not fixed automatically: removing a marketplace uninstalls its plugins and
    # deletes their saved options (pluginConfigs), which may hold work values.
    warn "marketplace nuno-mods points at $current, not this repo; skipped mods. To fix (resets mod options):"
    warn "  claude plugin marketplace remove nuno-mods && ./install.sh"
  fi
else
  warn "claude CLI not found, skipped mods"
fi

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

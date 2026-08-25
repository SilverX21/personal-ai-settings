#!/usr/bin/env bash
# Drop a preset into a project as real files (symlinks are dereferenced, so the
# target ends up self-contained and safe to commit).
#
#   ./use.sh                          list presets
#   ./use.sh dotnet-react ~/Projects/newapp
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ $# -lt 2 ]; then
  echo "usage: ./use.sh <preset> <target-dir>"
  echo
  echo "presets:"
  for p in "$REPO"/presets/*/; do
    printf '  %-14s %s\n' "$(basename "$p")" "$(sed -n '3p' "$p/CLAUDE.md")"
  done
  exit 1
fi

preset="$1"
target="$2"
src="$REPO/presets/$preset"

[ -d "$src" ] || { echo "no such preset: $preset" >&2; exit 1; }
[ -d "$target" ] || { echo "no such directory: $target" >&2; exit 1; }

# Refuse to silently clobber; the caller decides what to do about it.
for f in .claude CLAUDE.md AGENTS.md; do
  if [ -e "$target/$f" ]; then
    echo "$target/$f already exists — move it aside first" >&2
    exit 1
  fi
done

# -L dereferences the symlinks that keep this repo DRY, so the copy stands alone.
cp -RL "$src/.claude" "$target/.claude"
cp -L "$src/CLAUDE.md" "$target/CLAUDE.md"
cp -L "$src/AGENTS.md" "$target/AGENTS.md"

echo "copied '$preset' into $target"
echo
echo "next: fill in the <PLACEHOLDERS> in $target/CLAUDE.md"
# {2,} not * — keeps <Sln>, skips generics like Result<T>
grep -o '<[A-Za-z][^>]\{2,\}>' "$target/CLAUDE.md" | sort -u | sed 's/^/  /'

#!/usr/bin/env bash
# Shared helpers for the dotnet-master hook scripts.
# Sourced, never executed directly.

# Fail closed and silently if jq is unavailable — a hook must never break the session.
require_jq() { command -v jq >/dev/null 2>&1 || exit 0; }

# Read the edited file path out of the hook's JSON payload on stdin.
# Usage: FILE="$(hook_file_path "$INPUT")"
hook_file_path() { printf '%s' "$1" | jq -r '.tool_input.file_path // empty'; }

# True only for a C# source file this skill is allowed to touch.
# Deliberately narrow: this skill owns .NET artifacts and nothing else. A .NET repo
# legitimately contains .ts/.sql/.yml/Dockerfile — those are never ours to process.
is_csharp_source() {
  local f="$1"
  case "$f" in
    *.cs) ;;
    *) return 1 ;;                       # not C# — includes every other language
  esac
  case "$f" in
    */bin/*|*/obj/*|bin/*|obj/*) return 1 ;;          # build output
    */node_modules/*|*/.git/*) return 1 ;;            # vendor / VCS
    *.g.cs|*.generated.cs|*.Designer.cs) return 1 ;;  # generated
    *.AssemblyInfo.cs|*.GlobalUsings.g.cs) return 1 ;;
    */Migrations/*.Designer.cs) return 1 ;;
  esac
  [ -f "$f" ]
}

# Nearest .csproj/.fsproj/.vbproj walking up from a file. Empty if the file
# belongs to no .NET project — in which case we leave it alone.
owning_project() {
  local dir; dir="$(cd "$(dirname "$1")" 2>/dev/null && pwd)" || return 1
  while [ -n "$dir" ] && [ "$dir" != "/" ]; do
    local proj
    proj="$(find "$dir" -maxdepth 1 -name '*.csproj' -o -maxdepth 1 -name '*.fsproj' \
            -o -maxdepth 1 -name '*.vbproj' 2>/dev/null | head -1)"
    [ -n "$proj" ] && { printf '%s' "$proj"; return 0; }
    dir="$(dirname "$dir")"
  done
  return 1
}

# Is the owning project an ASP.NET Core / executable app (vs a class library)?
# Decides ConfigureAwait(false) guidance, which is correct in libraries and pointless in apps.
#
# FAILS SAFE: returns non-zero whenever it cannot tell. A wrong "app" verdict produces a
# false accusation on correct library code, which is worse than staying quiet.
is_app_project() {
  local proj="$1"
  [ -f "$proj" ] || return 1

  # The Web SDK is decisive on its own.
  grep -qi 'Sdk="Microsoft\.NET\.Sdk\.Web"' "$proj" 2>/dev/null && return 0
  grep -qi '<OutputType>\s*Exe\s*</OutputType>' "$proj" 2>/dev/null && return 0
  # An explicit library declaration is decisive the other way.
  grep -qi '<OutputType>\s*Library\s*</OutputType>' "$proj" 2>/dev/null && return 1

  # Properties are often hoisted into Directory.Build.props; check up the tree.
  local dir; dir="$(cd "$(dirname "$proj")" 2>/dev/null && pwd)" || return 1
  while [ -n "$dir" ] && [ "$dir" != "/" ]; do
    if [ -f "$dir/Directory.Build.props" ]; then
      grep -qi '<OutputType>\s*Exe\s*</OutputType>' "$dir/Directory.Build.props" 2>/dev/null && return 0
    fi
    dir="$(dirname "$dir")"
  done
  return 1   # undetermined → treat as library → stay quiet
}

# Strip content that must not be pattern-matched: raw string literals, verbatim and
# regular string literals, and // line comments. Cheap, line-oriented, good enough
# for a hook — it exists to stop false positives on prose and sample code.
#
# -E (ERE) is required: BSD sed does not support \| alternation in a basic regex,
# so the BRE form silently left string literals intact on macOS.
strip_noise() {
  # Pass 1 (awk): drop the bodies of multi-line raw string literals ("""...""").
  # sed is line-oriented and cannot see across the fence, so this runs first.
  awk '
    {
      line = $0
      gsub(/"""[^"]*"""/, "\"\"", line)        # single-line raw string → collapse
      n = gsub(/"""/, "\"\"\"", line)          # remaining fences on this line
      if (inraw) { if (n % 2 == 1) inraw = 0; next }   # inside a raw string → drop line
      if (n % 2 == 1) { inraw = 1; next }              # opening fence → drop line
      print line
    }
  ' "$1" |
  # Pass 2 (sed): verbatim strings, then regular strings, then line comments.
  # Strings before comments so a "https://..." literal cannot leave a dangling quote.
  sed -E -e 's/@"([^"]|"")*"/""/g' -e 's/"([^"\\]|\\.)*"/""/g' -e 's|//.*$||'
}

# Rules can be opted out per-project, e.g. DOTNET_MASTER_SKIP_RULES=result,configureawait
# Useful when a codebase has its own `Result` type whose `.Result` member is legitimate.
rule_enabled() {
  case ",${DOTNET_MASTER_SKIP_RULES:-}," in
    *",$1,"*) return 1 ;;
    *) return 0 ;;
  esac
}

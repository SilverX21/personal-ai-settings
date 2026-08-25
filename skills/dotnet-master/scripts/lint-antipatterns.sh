#!/usr/bin/env bash
# PostToolUse hook (matcher: Edit|Write) — flag banned patterns in an edited C# file and
# feed the findings back so they get fixed. Detection only; the file already changed.
#
# Scope: C# source only. Never inspects TypeScript, SQL, YAML, Dockerfiles or any other
# language a .NET repo may contain, and never inspects generated or build output.
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
. "$DIR/_common.sh"

require_jq
INPUT="$(cat)"
FILE="$(hook_file_path "$INPUT")"

[ -n "$FILE" ] || exit 0

# --- Project files: prerelease NuGet versions are forbidden outright ----------
# Checked before the C# gate because these are .csproj / Directory.Packages.props,
# not .cs. Still strictly .NET artifacts — no other language is inspected.
case "$FILE" in
  *.csproj|*.fsproj|*.vbproj|*Directory.Packages.props|*Directory.Build.props)
    [ -f "$FILE" ] || exit 0
    pre="$(grep -oE '(Version|VersionOverride)="[^"]*-[A-Za-z][^"]*"' "$FILE" 2>/dev/null \
           | sed -E 's/.*="([^"]*)"/\1/' | sort -u)"
    wild="$(grep -oE '(Version|VersionOverride)="[^"]*\*[^"]*"' "$FILE" 2>/dev/null \
           | sed -E 's/.*="([^"]*)"/\1/' | sort -u)"
    [ -z "$pre" ] && [ -z "$wild" ] && exit 0
    msg="dotnet-master NuGet policy violated in $FILE:"$'\n'
    [ -n "$pre" ]  && msg+="- Prerelease versions are FORBIDDEN: $(printf '%s' "$pre" | tr '\n' ' ')"$'\n'
    [ -n "$wild" ] && msg+="- Wildcard versions are forbidden: $(printf '%s' "$wild" | tr '\n' ' ')"$'\n'
    msg+=$'\n'"Pin the last stable release. If no stable release exists, the package is not adoptable."
    jq -n --arg r "$msg" '{decision: "block", reason: $r}'
    exit 0
    ;;
esac

is_csharp_source "$FILE" || exit 0

# Match against a comment- and string-stripped copy so sample code in a comment,
# or the literal "async void" inside a message, doesn't trip a rule.
SRC="$(strip_noise "$FILE")"

violations=""
flag() {
  if printf '%s' "$SRC" | grep -qE "$1"; then
    violations+="- $2"$'\n'
  fi
}

# --- Blocking: these are wrong in every .NET project -------------------------
flag '\.GetAwaiter\(\)\.GetResult\(\)' 'sync-over-async .GetAwaiter().GetResult() — await it instead'
flag '\.Wait\(\)'                      '.Wait() on a Task — await it instead (deadlock risk)'
flag '\bnew +HttpClient\('             'new HttpClient() — inject IHttpClientFactory (socket exhaustion)'
flag 'throw +new +Exception\('         'generic Exception thrown — use a specific type, or return an Error'
flag '= *default!'                     'default! used to silence a nullable warning'
flag '\.SaveChanges\(\)'               'synchronous SaveChanges() — use SaveChangesAsync(cancellationToken)'
flag 'Log(Information|Warning|Error|Debug|Critical|Trace)\(\$"' \
     'string interpolation in a log message — use structured properties'

# .Result on a Task. Known non-Task ".Result" types are excluded to cut false positives.
# A codebase with its own Result type can silence this: DOTNET_MASTER_SKIP_RULES=result
if rule_enabled result && printf '%s' "$SRC" \
   | grep -vE '(Identity|SignIn|Validation|Password|Authenticate|Authorization|Token)Result\b' \
   | grep -qE '\.Result\b'; then
  violations+="- .Result on a Task — await it instead (deadlock risk)"$'\n'
fi

# async void is legitimate for an event handler; flag only non-handler signatures.
if printf '%s' "$SRC" | grep -E 'async +void' | grep -qvE '\(object.*EventArgs|\(object\? *sender'; then
  violations+="- async void outside an event handler — use async Task"$'\n'
fi

# --- Context-dependent: ConfigureAwait(false) --------------------------------
# Correct and recommended in a class library; a no-op in an ASP.NET Core app.
# Flag it only when the owning project is an app, matching SKILL.md.
if rule_enabled configureawait && printf '%s' "$SRC" | grep -qE '\.ConfigureAwait\(false\)'; then
  proj="$(owning_project "$FILE" || true)"
  if [ -n "$proj" ] && is_app_project "$proj"; then
    violations+="- ConfigureAwait(false) in an app project — no synchronization context, so it does nothing (it IS correct in a class library)"$'\n'
  fi
fi

[ -z "$violations" ] && exit 0

reason="dotnet-master standards check flagged $FILE:"$'\n'"$violations"$'\n'"Please fix these before continuing."
jq -n --arg r "$reason" '{decision: "block", reason: $r}'
exit 0

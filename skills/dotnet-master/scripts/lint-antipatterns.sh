#!/usr/bin/env bash
# PostToolUse hook (matcher: Edit|Write) — flag banned patterns in edited C# files and
# feed the findings back to Claude so it fixes them. Detection only (the file already changed).
# This encodes the dotnet-master skill's "never do these" list as a deterministic check.
set -uo pipefail

INPUT="$(cat)"
FILE="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty')"

case "$FILE" in
  *.cs) ;;
  *) exit 0 ;;
esac
[ -f "$FILE" ] || exit 0

violations=""
flag() { if grep -nqE "$1" "$FILE" 2>/dev/null; then violations+="- $2"$'\n'; fi; }

flag '\.Result\b'                                              '.Result on a Task — await it instead (deadlock risk)'
flag '\.Wait\(\)'                                              '.Wait() on a Task — await it instead (deadlock risk)'
flag 'async +void'                                             'async void — use async Task (except event handlers)'
flag 'new +HttpClient\('                                       'new HttpClient() — inject IHttpClientFactory'
flag 'throw +new +Exception\('                                 'generic Exception thrown — use a specific exception type'
flag '\.ConfigureAwait\(false\)'                               'ConfigureAwait(false) — unnecessary in ASP.NET Core'
flag 'Log(Information|Warning|Error|Debug|Critical|Trace)\(\$"' 'string interpolation in a log message — use structured properties'
flag '= *default!'                                             'default! used to silence a nullable warning'
flag '\.SaveChanges\(\)'                                       'synchronous SaveChanges() — use SaveChangesAsync(cancellationToken)'

[ -z "$violations" ] && exit 0

reason="dotnet-master standards check flagged $FILE:"$'\n'"$violations"$'\n'"Please fix these before continuing."
jq -n --arg r "$reason" '{decision: "block", reason: $r}'
exit 0

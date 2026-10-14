// Pure command classification: no engine calls, so tests and node can run it directly.

export type Hit = { kind: 'suite' | 'push'; segment: string; reason: string }

const ENV_PREFIX = /^(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|\S*)\s+)+/
const KEYWORD_PREFIX = /^(?:(?:do|then|else|time|nohup|timeout\s+\S+|\{)\s+|\(\s*)/
const REDIRECTS = /\s*\d*>>?&?\s*\S+/g

// Flags whose value is the next token, so it isn't mistaken for a file argument.
const VALUE_FLAGS: Record<string, readonly string[]> = {
  vitest: ['--reporter', '--outputFile', '-c', '--config', '--project', '--maxWorkers', '--pool', '--environment', '--dir', '--root', '--shard'],
  dotnet: ['-c', '--configuration', '--logger', '-l', '-f', '--framework', '-r', '--runtime', '--results-directory', '-v', '--verbosity', '-s', '--settings', '--collect', '-a', '--arch', '-o', '--output'],
  playwright: ['-c', '--config', '--project', '--reporter', '--workers', '-j', '--retries', '--output', '--shard'],
}
const SCOPE_FLAGS = /^(?:-t|--test|--testNamePattern|--testFile|--filter|-g|--grep|--related)(?:=|$)/

const SUITE_SCRIPTS = /^test(?::(?:all|web|api|libs|e2e)(?::\S*)?)?$/

// Splits on && || ; | and newlines, but never inside quotes (grep -E "a|vitest" is one segment).
export function segments(command: string): string[] {
  const out: string[] = []
  let current = ''
  let quote = ''
  for (let i = 0; i < command.length; i++) {
    const ch = command[i]!
    if (quote) {
      if (ch === quote) quote = ''
      current += ch
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      current += ch
      continue
    }
    const pair = command.slice(i, i + 2)
    if (pair === '&&' || pair === '||') {
      out.push(current)
      current = ''
      i++
      continue
    }
    if (ch === ';' || ch === '|' || ch === '\n') {
      out.push(current)
      current = ''
      continue
    }
    current += ch
  }
  out.push(current)
  return out
}

export function tokenize(segment: string): string[] {
  return (segment.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map(t => t.replace(/^(["'])(.*)\1$/, '$2'))
}

function clean(segment: string): string {
  let s = segment.trim()
  for (let prev = ''; prev !== s; ) {
    prev = s
    s = s.replace(KEYWORD_PREFIX, '').replace(ENV_PREFIX, '').trim()
  }
  return s.replace(REDIRECTS, '').replace(/[)}]+$/, '').trim()
}

function positionals(args: readonly string[], valueFlags: readonly string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!
    if (a === '--') continue
    if (a.startsWith('-')) {
      if (!a.includes('=') && valueFlags.includes(a)) i++
      continue
    }
    out.push(a)
  }
  return out
}

const hasScope = (args: readonly string[]) => args.some(a => SCOPE_FLAGS.test(a))
const targetsTest = (args: readonly string[]) =>
  args.some((a, i) => {
    const value = /^(?:-t|--targets?)=(.*)$/.exec(a)?.[1] ?? (/^(?:-t|--targets?)$/.test(a) ? args[i + 1] : undefined)
    return value !== undefined && value.split(',').includes('test')
  })

function classifyNx(args: readonly string[]): string | null {
  const [verb, target] = args
  if ((verb === 'affected' || verb === 'run-many') && targetsTest(args)) return `nx ${verb} with the test target`
  if (verb === 'test' && target && !hasScope(args)) {
    return args.includes('--') ? `nx test ${target} ignores the path after --; it runs the whole suite` : `nx test ${target} runs the whole project suite`
  }
  if (verb === 'run' && target && /:test(?::|$)/.test(target) && !hasScope(args)) return `nx run ${target} runs the whole project suite`
  return null
}

function classifyTokens(tokens: string[]): string | null {
  // Unwrap package-runner prefixes: pnpm/npm/yarn [--filter X] [exec|run|dlx] <tool|script> ...
  let t = tokens
  if (['pnpm', 'npm', 'yarn', 'npx'].includes(t[0] ?? '')) {
    t = t.slice(1)
    while (t[0]?.startsWith('-')) {
      const takesValue = !t[0].includes('=') && ['--filter', '-F', '-C', '--dir'].includes(t[0])
      t = t.slice(takesValue ? 2 : 1)
    }
    if (['exec', 'run', 'dlx', 'x'].includes(t[0] ?? '')) t = t.slice(1)
    const script = t[0] ?? ''
    if (SUITE_SCRIPTS.test(script) && !['nx', 'vitest', 'playwright'].includes(script)) {
      if (script === 'test' && t.length > 1) return null
      return `the "${script}" script runs a whole suite`
    }
  }
  const [tool, ...args] = t
  if (tool === 'nx') return classifyNx(args)
  if (tool === 'vitest') {
    const rest = args[0] === 'run' ? args.slice(1) : args
    if (rest[0] === 'related' || hasScope(rest)) return null
    return positionals(rest, VALUE_FLAGS.vitest!).length === 0 ? 'vitest with no test file runs the whole suite' : null
  }
  if (tool === 'dotnet' && args[0] === 'test') {
    const rest = args.slice(1)
    if (hasScope(rest)) return null
    const target = positionals(rest, VALUE_FLAGS.dotnet!)[0]
    if (target === undefined) return 'dotnet test with no project runs every test project'
    return /\.slnx?$/.test(target) ? `dotnet test on ${target} without --filter runs the whole solution` : null
  }
  if (tool === 'playwright' && args[0] === 'test') {
    const rest = args.slice(1)
    if (hasScope(rest)) return null
    return positionals(rest, VALUE_FLAGS.playwright!).length === 0 ? 'playwright test with no spec runs the whole e2e suite' : null
  }
  return null
}

export function classify(command: string): Hit | null {
  for (const raw of segments(command)) {
    const segment = clean(raw)
    const tokens = tokenize(segment)
    if (tokens[0] === 'git' && tokens[1] === 'push') {
      const flags = tokens.slice(2)
      if (!flags.includes('--no-verify') && !flags.includes('--dry-run') && !flags.includes('-n')) {
        return { kind: 'push', segment, reason: 'git push runs the pre-push hook (affected tests)' }
      }
      continue
    }
    const reason = classifyTokens(tokens)
    if (reason) return { kind: 'suite', segment, reason }
  }
  return null
}

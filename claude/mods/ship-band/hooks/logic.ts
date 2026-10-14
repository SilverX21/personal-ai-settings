export const STEPS = ['WI', 'Plan', 'Impl', 'Tests', 'Review', 'Security', 'Docs', 'Commit', 'PR', 'Merged'] as const
export type Step = (typeof STEPS)[number]
export type Source = 'azure' | 'github' | 'none'
export const SOURCES: readonly Source[] = ['azure', 'github', 'none']
export type Steps = Partial<Record<string, 'done' | 'stale'>>

export type Signal =
  | { kind: 'branch'; branch: string; source: Source }
  | { kind: 'azure-wi' }
  | { kind: 'plan' }
  | { kind: 'edit'; path: string }
  | { kind: 'tests-pass' }
  | { kind: 'skill'; skill: string; isStale: boolean }
  | { kind: 'commit' }
  | { kind: 'pr' }
  | { kind: 'merged' }

// `PRPrep` is not a band step: it records that /prepare-pr ran, so the PR step can move on to pushing and opening the PR.
export const SKILL_STEP: Record<string, string> = {
  plan: 'Plan',
  'code-review': 'Review',
  'security-review': 'Security',
  'document-feature': 'Docs',
  'prepare-pr': 'PRPrep',
}

// What the Next button puts in the prompt for each step.
const NEXT_TEXT: Partial<Record<Step, string>> = {
  Plan: '/plan ',
  Impl: 'Implement the plan.',
  Tests: 'Run the tests for the affected slice.',
  Review: '/code-review',
  Security: '/security-review',
  Docs: '/document-feature',
  Commit: 'commit',
  PR: '/prepare-pr',
}

// Only a review or scan can go out of date when code changes after it.
const CAN_GO_STALE = ['Review', 'Security']

export function nextText(step: Step, source: Source, steps: Steps): string | undefined {
  if (step === 'PR') return steps.PRPrep === 'done' ? 'push and create the PR' : NEXT_TEXT.PR
  if (step === 'WI') return source === 'azure' ? '/azure-wi ' : 'Fetch the GitHub issue with `gh issue view`: '
  return NEXT_TEXT[step]
}

// Where the work items live decides whether the WI step exists and how a branch names its item.
export const stepsFor = (source: Source): readonly Step[] => (source === 'none' ? STEPS.filter(s => s !== 'WI') : STEPS)

export function wiId(branch: string, source: Source): string | undefined {
  if (source === 'azure') return /\b\d{5}\b/.exec(branch)?.[0]
  if (source === 'github') return /(?:^|[/-])#?(\d{1,6})(?=[-_/]|$)/.exec(branch)?.[1]
  return undefined
}

const TEST_CMD = /\b(vitest|jest|pytest|dotnet test|go test|cargo test|(?:npm|pnpm|yarn)(?: run)? [\w:-]*test[\w:-]*|nx .*\btest\b)/
const NOT_SOURCE = /(^|\/)(docs|\.claude)\/|\.(md|mdx|txt)$/i
const PLAN_FILE = /(^|\/)docs\/plans\/.*\.md$/i

export const skillName = (name: string): string => name.split(':').pop() ?? name

export function apply(steps: Steps, s: Signal): Steps {
  const next = { ...steps }
  switch (s.kind) {
    case 'branch':
      if (wiId(s.branch, s.source)) next.WI ??= 'done'
      break
    case 'azure-wi':
      next.WI = 'done'
      break
    case 'plan':
      next.Plan = 'done'
      break
    case 'edit':
      next.Impl = 'done'
      // Honesty rule: a review or scan that ran before this edit no longer covers the code.
      for (const k of ['Review', 'Security']) if (next[k] === 'done') next[k] = 'stale'
      break
    case 'tests-pass':
      next.Tests = 'done'
      break
    case 'skill': {
      const step = SKILL_STEP[s.skill]
      if (step) next[step] = s.isStale && CAN_GO_STALE.includes(step) ? 'stale' : 'done'
      break
    }
    case 'commit':
      next.Commit = 'done'
      break
    case 'pr':
      next.PR = 'done'
      break
    case 'merged':
      next.Merged = 'done'
      break
  }
  return next
}

// The first step not done (a stale one counts as not done), or null when all are.
export function current(steps: Steps, source: Source): Step | null {
  return stepsFor(source).find(s => steps[s] !== 'done') ?? null
}

export function formatSteps(steps: Steps, source: Source): string {
  const cur = current(steps, source)
  return stepsFor(source)
    .map(s => `${s} ${steps[s] === 'done' ? '✓' : steps[s] === 'stale' ? '⟳' : s === cur ? '●' : '○'}`)
    .join(' ')
}

export function formatLine(branch: string, steps: Steps, source: Source): string {
  const id = wiId(branch, source)
  return `${id ? `#${id} ` : ''}${branch}  ${formatSteps(steps, source)}`
}

// A source-file edit marks Impl; a write to docs/plans/*.md marks Plan; other docs mark nothing.
export function editSignal(path: string): Signal | undefined {
  if (PLAN_FILE.test(path)) return { kind: 'plan' }
  return NOT_SOURCE.test(path) ? undefined : { kind: 'edit', path }
}

export type BashSignal = Signal | 'branch-changed' | undefined

export function bashSignal(command: string, isError: boolean, output: string): BashSignal {
  if (isError) return undefined
  if (/\bgit (checkout|switch)\b/.test(command)) return 'branch-changed'
  if (/\bgit commit\b/.test(command) && !/--dry-run/.test(command)) return { kind: 'commit' }
  if (/\baz repos pr create\b/.test(command)) return { kind: 'pr' }
  if (/\baz repos pr show\b/.test(command) && /"status":\s*"completed"/.test(output)) return { kind: 'merged' }
  if (TEST_CMD.test(command)) return { kind: 'tests-pass' }
  return undefined
}

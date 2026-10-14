import { expect, test } from 'claude-code/testing'

import { SKILL_STEP, apply, bashSignal, current, editSignal, formatSteps, nextText, wiId } from '../hooks/logic'
import type { Signal, Steps } from '../hooks/logic'

const run = (signals: Signal[], from: Steps = {}) => signals.reduce(apply, from)

test('a recorded delivery sequence walks the steps in order', () => {
  let steps: Steps = run([{ kind: 'branch', branch: 'feat/12345-export', source: 'azure' }])
  expect(steps).toEqual({ WI: 'done' })
  expect(current(steps, 'azure')).toBe('Plan')

  steps = run(
    [
      { kind: 'plan' },
      { kind: 'edit', path: 'src/a.ts' },
      { kind: 'tests-pass' },
      { kind: 'skill', skill: 'code-review', isStale: false },
      { kind: 'skill', skill: 'security-review', isStale: false },
      { kind: 'skill', skill: 'document-feature', isStale: false },
      { kind: 'commit' },
    ],
    steps,
  )
  expect(current(steps, 'azure')).toBe('PR')
  expect(formatSteps(steps, 'azure')).toBe('WI ✓ Plan ✓ Impl ✓ Tests ✓ Review ✓ Security ✓ Docs ✓ Commit ✓ PR ● Merged ○')
})

test('an edit after review or security marks them stale; re-running clears it', () => {
  const reviewed = run([
    { kind: 'azure-wi' },
    { kind: 'plan' },
    { kind: 'edit', path: 'src/a.ts' },
    { kind: 'skill', skill: 'code-review', isStale: false },
    { kind: 'skill', skill: 'security-review', isStale: false },
  ])
  const edited = apply(reviewed, { kind: 'edit', path: 'src/b.ts' })
  expect(edited.Review).toBe('stale')
  expect(edited.Security).toBe('stale')
  expect(current(edited, 'azure')).toBe('Tests')
  expect(apply(edited, { kind: 'skill', skill: 'code-review', isStale: false }).Review).toBe('done')
})

test('a skill that was edited over in its own turn ends stale', () => {
  expect(apply({}, { kind: 'skill', skill: 'code-review', isStale: true }).Review).toBe('stale')
})

test('editSignal: source marks Impl, plan files mark Plan, docs mark nothing', () => {
  expect(editSignal('/r/src/a.ts')).toEqual({ kind: 'edit', path: '/r/src/a.ts' })
  expect(editSignal('/r/docs/plans/x.md')).toEqual({ kind: 'plan' })
  expect(editSignal('/r/README.md')).toBeUndefined()
  expect(editSignal('/r/docs/guide.html')).toBeUndefined()
})

test('bashSignal reads commands and their outcome', () => {
  expect(bashSignal('pnpm nx affected -t test', false, '')).toEqual({ kind: 'tests-pass' })
  expect(bashSignal('pnpm nx affected -t test', true, '')).toBeUndefined()
  expect(bashSignal('dotnet test src/X.Tests', false, '')).toEqual({ kind: 'tests-pass' })
  expect(bashSignal('git add . && git commit -m "x"', false, '')).toEqual({ kind: 'commit' })
  expect(bashSignal('git commit --dry-run', false, '')).toBeUndefined()
  expect(bashSignal('az repos pr create --title x', false, '')).toEqual({ kind: 'pr' })
  expect(bashSignal('az repos pr show --id 7', false, '{"status": "completed"}')).toEqual({ kind: 'merged' })
  expect(bashSignal('az repos pr show --id 7', false, '{"status": "active"}')).toBeUndefined()
  expect(bashSignal('git switch main', false, '')).toBe('branch-changed')
  expect(bashSignal('ls', false, '')).toBeUndefined()
})

test('the work-item source decides the WI step', () => {
  expect(wiId('feat/12345-x', 'azure')).toBe('12345')
  expect(wiId('feat/42-x', 'azure')).toBeUndefined()
  expect(wiId('42-fix-login', 'github')).toBe('42')
  expect(wiId('fix/#42-login', 'github')).toBe('42')
  expect(wiId('feat/v2-rewrite', 'github')).toBeUndefined()
  expect(wiId('feat/12345-x', 'none')).toBeUndefined()

  expect(formatSteps({}, 'none')).toBe('Plan ● Impl ○ Tests ○ Review ○ Security ○ Docs ○ Commit ○ PR ○ Merged ○')
  expect(current({}, 'none')).toBe('Plan')
  expect(nextText('WI', 'azure', {})).toBe('/azure-wi ')
  expect(nextText('WI', 'github', {})).toContain('gh issue view')
  expect(apply({}, { kind: 'branch', branch: '42-fix', source: 'github' }).WI).toBe('done')
})

test('only Review and Security can go stale', () => {
  for (const skill of ['plan', 'document-feature', 'prepare-pr']) {
    const steps = apply({}, { kind: 'skill', skill, isStale: true })
    expect(Object.values(steps)).toEqual(['done'])
  }
  expect(apply({}, { kind: 'skill', skill: 'code-review', isStale: true }).Review).toBe('stale')
  expect(apply({}, { kind: 'skill', skill: 'security-review', isStale: true }).Security).toBe('stale')
  // plan then implement in one turn: Plan stays done
  expect(apply(apply({}, { kind: 'skill', skill: 'plan', isStale: true }), { kind: 'edit', path: 'src/a.ts' }).Plan).toBe('done')
})

test('the PR step asks for /prepare-pr, then for the push, and is done only when the PR is opened', () => {
  expect(SKILL_STEP['prepare-pr']).toBe('PRPrep')
  const upToCommit = run([{ kind: 'azure-wi' }, { kind: 'plan' }, { kind: 'edit', path: 'src/a.ts' }, { kind: 'tests-pass' }, { kind: 'commit' }])
  let steps = run(
    [
      { kind: 'skill', skill: 'code-review', isStale: false },
      { kind: 'skill', skill: 'security-review', isStale: false },
      { kind: 'skill', skill: 'document-feature', isStale: false },
    ],
    upToCommit,
  )
  expect(current(steps, 'azure')).toBe('PR')
  expect(nextText('PR', 'azure', steps)).toBe('/prepare-pr')

  steps = apply(steps, { kind: 'skill', skill: 'prepare-pr', isStale: false })
  expect(current(steps, 'azure')).toBe('PR')
  expect(nextText('PR', 'azure', steps)).toBe('push and create the PR')
  expect(formatSteps(steps, 'azure')).toContain('PR ●')

  steps = apply(steps, { kind: 'pr' })
  expect(current(steps, 'azure')).toBe('Merged')
})

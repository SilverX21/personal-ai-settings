import { expect, test } from 'claude-code/testing'

import { classify, segments } from '../hooks/logic'
import { FIXTURES } from './fixtures'

test('every fixture command is classified as labelled', () => {
  const wrong = FIXTURES.filter(([kind, command]) => (classify(command)?.kind ?? 'pass') !== kind)
  expect(wrong).toEqual([])
})

test('separators inside quotes do not split a command', () => {
  expect(segments('grep -E "a|vitest" x && pnpm test')).toEqual(['grep -E "a|vitest" x ', ' pnpm test'])
})

test('nx test with a path after -- says the path is ignored', () => {
  expect(classify('pnpm nx test web -- src/a.test.tsx')?.reason).toContain('ignores the path')
})

test('help and version flags run no tests, so they are never caught', () => {
  for (const flag of ['--help', '-h', '--version']) {
    expect(classify(`pnpm test:all ${flag}`)).toBeNull()
  }
  expect(classify('pnpm test:all --help && pnpm test:all')?.segment).toBe('pnpm test:all')
})

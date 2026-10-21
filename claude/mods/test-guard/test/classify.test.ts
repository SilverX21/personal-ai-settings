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

test('npm test with only flags after -- still runs the whole suite', () => {
  expect(classify('npm test -- --coverage')?.kind).toBe('suite')
  expect(classify('pnpm test --watch=false')?.kind).toBe('suite')
})

test('bash -c "…" is classified by the command inside it', () => {
  expect(classify('bash -c "pnpm test"')?.kind).toBe('suite')
  expect(classify("zsh -lc 'make test'")?.kind).toBe('suite')
  expect(classify('bash -c "echo hi"')).toBeNull()
})

test('pytest with no path or filter runs the whole suite, also behind a launcher', () => {
  expect(classify('pytest')?.kind).toBe('suite')
  expect(classify('pytest -q --maxfail=1')?.kind).toBe('suite')
  expect(classify('python3 -m pytest')?.kind).toBe('suite')
  expect(classify('uv run pytest -x')?.kind).toBe('suite')
})

test('make test and other test-target tools run the whole suite', () => {
  for (const command of ['make test', 'make -j4 test', 'just test', 'cargo test', 'go test ./...', 'mvn clean test', './gradlew test', 'bun test']) {
    expect(classify(command)?.kind, command).toBe('suite')
  }
})

test('a test path or name filter keeps the new rules quiet', () => {
  for (const command of [
    'npm test -- src/a.test.ts',
    'npm test -- -t login',
    'pytest tests/test_a.py::test_x',
    'pytest -k login',
    'pytest --collect-only',
    'jest src/a.test.ts',
    'bash -c "pnpm test src/a.test.ts"',
    'make build',
    'cargo test parser',
    'go test -run TestA ./...',
    'go test ./pkg/a',
    'mvn -Dtest=FooTest test',
    './gradlew test --tests Foo',
  ]) {
    expect(classify(command), command).toBeNull()
  }
})

import { expect, test } from 'claude-code/testing'

import { banner, doneText, isTaskOutputPath, minMs, parseTaskNote, parseTestCounts, taskText, testsText } from '../hooks/logic'

// Invented test-runner summaries in the layouts of Vitest, Jest and dotnet test.
const VITEST = ` Test Files  1 failed | 2 passed (3)
      Tests  3 failed | 42 passed (45)
   Duration  4.21s
`
const VITEST_OK = '      Tests  42 passed (42)\n'
const VITEST_SKIP = '      Tests  1 failed | 2 skipped | 40 passed (43)\n'
const JEST = 'Tests:       3 failed, 42 passed, 45 total\nTime:        2.1 s\n'
const DOTNET = `Passed!  - Failed:     0, Passed:    30, Skipped:     0, Total:    30, Duration: 2 s - A.Tests.dll (net8.0)
Failed!  - Failed:     2, Passed:    12, Skipped:     0, Total:    14, Duration: 1 s - B.Tests.dll (net8.0)
`
const ESC = String.fromCharCode(27)

test('test counts from Vitest, Jest and dotnet test', () => {
  expect(parseTestCounts(VITEST)).toEqual({ passed: 42, failed: 3 })
  expect(parseTestCounts(VITEST_OK)).toEqual({ passed: 42, failed: 0 })
  expect(parseTestCounts(VITEST_SKIP)).toEqual({ passed: 40, failed: 1 })
  expect(parseTestCounts(JEST)).toEqual({ passed: 42, failed: 3 })
  expect(parseTestCounts(DOTNET)).toEqual({ passed: 42, failed: 2 })
  expect(parseTestCounts('npm WARN nothing to see here\n')).toBeUndefined()
  expect(parseTestCounts('Tests are great\n')).toBeUndefined()
})

test('every summary in the output is added up, across runners too', () => {
  const twoProjects = `${VITEST}\n${VITEST_OK}`
  expect(parseTestCounts(twoProjects)).toEqual({ passed: 84, failed: 3 })
  expect(parseTestCounts(`${VITEST}${DOTNET}`)).toEqual({ passed: 84, failed: 5 })
})

test('colour codes in the output do not hide the counts', () => {
  const coloured = ` ${ESC}[2mTest Files${ESC}[22m  1 passed\n      ${ESC}[2m     Tests${ESC}[22m  ${ESC}[1m${ESC}[32m42 passed${ESC}[39m${ESC}[22m (42)\n`
  expect(parseTestCounts(coloured)).toEqual({ passed: 42, failed: 0 })
  const plainStart = `${ESC}[32mTests:${ESC}[39m       1 failed, 2 passed, 3 total\n`
  expect(parseTestCounts(plainStart)).toEqual({ passed: 2, failed: 1 })
})

test('the counts read as the spec words them', () => {
  expect(testsText({ passed: 42, failed: 3 })).toBe('Tests: 42 passed, 3 failed')
})

test('banner text has no escape codes, line breaks or control characters, and a bounded length', () => {
  expect(banner(`a${ESC}[31mred${ESC}[0m\nb\tc${ESC}]0;title\x07 d`)).toBe('ared b c d')
  expect(banner('x'.repeat(500)).length).toBe(160)
  expect(banner('  \n  ')).toBe('')
})

test('doneText uses the first non-empty line of the answer, cleaned', () => {
  expect(doneText('\n  Fixed the login bug.\nMore detail below.')).toBe('Done: Fixed the login bug.')
  expect(doneText(`${ESC}[1mBold${ESC}[0m start`)).toBe('Done: Bold start')
  expect(doneText('')).toBe('Done')
  expect(doneText('x'.repeat(500)).length).toBe(160)
})

test('minSeconds: a bad or negative value falls back to 120 s, zero is allowed', () => {
  expect(minMs(120)).toBe(120_000)
  expect(minMs(10)).toBe(10_000)
  expect(minMs(0)).toBe(0)
  for (const bad of [undefined, 'abc', NaN, -5, Infinity, {}]) expect(minMs(bad)).toBe(120_000)
  expect(minMs('30')).toBe(30_000)
})

test('a task notification is read for its status, summary and output file', () => {
  const note = parseTaskNote(`<task-notification>
<task-id>a1b2c3</task-id>
<status>completed</status>
<summary>Agent "Standards review" finished</summary>
<output-file>/private/tmp/claude-1/s/tasks/a1b2c3.output</output-file>
</task-notification>`)
  expect(note).toEqual({ id: 'a1b2c3', status: 'completed', summary: 'Agent "Standards review" finished', outputFile: '/private/tmp/claude-1/s/tasks/a1b2c3.output' })
  expect(parseTaskNote('plain text')).toEqual({ id: undefined, status: undefined, summary: undefined, outputFile: undefined })
})

test('taskText prefers the test counts and falls back to a cleaned summary', () => {
  expect(taskText({ summary: 'Background command "pnpm test" completed' }, { passed: 5, failed: 0 })).toBe('Tests: 5 passed, 0 failed')
  expect(taskText({ summary: 'Agent "X" finished' }, undefined)).toBe('Agent "X" finished')
  expect(taskText({ summary: `bad${ESC}[31m\nline` }, undefined)).toBe('bad line')
  expect(taskText({ status: 'failed' }, undefined)).toBe('Background task failed')
})

test('only this session\'s task output files pass the shape check', () => {
  const ok = '/private/tmp/claude-1/proj/sess-1/tasks/b1.output'
  expect(isTaskOutputPath(ok, 'sess-1')).toBe(true)
  expect(isTaskOutputPath('/tmp/with space/sess-1/tasks/b1.output', 'sess-1')).toBe(true)
  const bad = [
    '/etc/passwd',
    '/Users/dev/.ssh/id_rsa',
    '/tmp/x/other-session/tasks/b1.output', // another session's folder
    '/tmp/x/sess-1/notes/b1.output', // not the tasks folder
    '/tmp/x/sess-1/tasks/b1.txt',
    '/tmp/x/sess-1/tasks/../../../etc/passwd.output',
    '/private/../etc/sess-1/tasks/x.output',
    '/tmp/./x/sess-1/tasks/x.output',
    'sess-1/tasks/x.output', // not absolute
    '//sess-1/tasks/x.output',
    '/sess-1/tasks/x.output', // no folder above the session
  ]
  for (const p of bad) expect(isTaskOutputPath(p, 'sess-1')).toBe(false)
  for (const id of ['', '../x', 'a/b', 'a b']) expect(isTaskOutputPath(`/tmp/${id}/tasks/x.output`, id)).toBe(false)
})

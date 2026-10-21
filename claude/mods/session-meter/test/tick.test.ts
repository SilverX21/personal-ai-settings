import { expect, mock, test } from 'claude-code/testing'

// Regression: every session.start used to add another 15 s timer, so a refresh ran once per start on each tick.
test('repeated session.start keeps a single refresh timer', async ($, on) => {
  const clock = mock.clock(on)
  mock.store(on)
  let usageCalls = 0
  on('session.id', () => ({ value: 'abc' }))
  on('session.cwd', () => ({ value: '/repo' }))
  on('session.model', () => ({ value: 'claude-sonnet-5-5' }))
  on('session.usage', () => {
    usageCalls++
    return { value: { startedAt: 0, context: { tokens: 5_000, window: 200_000, percent: 2 }, rateLimits: [] } }
  })
  on('process.run', () => ({ value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }))
  on('command.register', () => ({ value: undefined }))
  on('session.start', () => ({ cwd: '/repo' }))

  for (let i = 0; i < 3; i++) await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await clock.settle()
  usageCalls = 0

  await clock.advance(15_000)
  await clock.settle()
  expect(usageCalls).toBe(1)
})

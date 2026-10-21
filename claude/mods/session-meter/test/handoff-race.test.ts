import { expect, mock, test } from 'claude-code/testing'

const done = (turnId: string) => ({ reason: 'answer', answer: '', turnId, durationMs: 1, isAborted: false }) as const

test('a handoff started mid-turn is not finished by the turn that was already running', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  const copies: string[] = []
  const toasts: string[] = []
  on('session.id', () => ({ value: 'abc' }))
  on('session.cwd', () => ({ value: '/repo' }))
  on('session.model', () => ({ value: 'claude-sonnet-5-5' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 5_000, window: 200_000, percent: 2 }, rateLimits: [] } }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('env.get', () => ({ value: '/tmp' }))
  on('fs.exists', () => ({ value: true }))
  on('fs.read', () => ({ value: 'HANDOFF TEXT' }))
  on('ui.copy', (_$, e) => {
    copies.push(e.text)
    return { value: { isCopied: true } }
  })
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }))
  on('command.register', () => ({ value: undefined }))
  on('session.start', () => ({ cwd: '/repo' }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  // The /handoff command the mod runs; it only has to succeed.
  on('command.run', { command: 'handoff' }, () => ({ text: '' }))
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })

  // Handoff is requested while turn "busy" is still running.
  await $.turn.start({ text: 'working', turnId: 'busy' })
  await $.command.run({ command: 'session-meter', args: 'handoff' })
  await $.turn.complete(done('busy'))
  expect(copies).toEqual([])
  expect(toasts.filter(t => t.includes('Handoff'))).toEqual([])

  // The turn the handoff command itself started is the one that finishes it.
  await $.turn.start({ text: '/handoff', turnId: 'handoff-turn' })
  await $.turn.complete(done('handoff-turn'))
  expect(copies).toEqual(['HANDOFF TEXT'])
})

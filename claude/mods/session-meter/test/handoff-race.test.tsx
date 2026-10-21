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

test('the "handoff copied" line clears when the next turn starts', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  on('session.id', () => ({ value: 'abc' }))
  on('session.cwd', () => ({ value: '/repo' }))
  on('session.model', () => ({ value: 'claude-sonnet-5-5' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 5_000, window: 200_000, percent: 2 }, rateLimits: [] } }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('env.get', () => ({ value: '/tmp' }))
  on('fs.exists', () => ({ value: true }))
  on('fs.read', () => ({ value: 'HANDOFF TEXT' }))
  on('ui.copy', () => ({ value: { isCopied: true } }))
  on('ui.toast', () => ({ value: undefined }))
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }))
  on('command.register', () => ({ value: undefined }))
  on('session.start', () => ({ cwd: '/repo' }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('ui.render', (_$, e) => {
    const { Text } = _$.ui.resolve(e)
    return <Text>base</Text>
  })
  on('command.run', { command: 'handoff' }, () => ({ text: '' }))
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })

  await $.command.run({ command: 'session-meter', args: 'handoff' })
  await $.turn.start({ text: '/handoff', turnId: 'h' })
  await $.turn.complete(done('h'))

  const props = { hasSurvey: false, isWorking: false, maxRows: 5, bodyColumns: 120, scroll: { offset: 0, bodyRows: 5 }, view: {} }
  const shown = await $.ui.mount({ plugin: 'session-meter', surface: 'terminal', component: 'AbovePrompt', props })
  expect(await shown.find({ type: 'Text', text: /handoff copied/ })).toBeDefined()
  await shown.unmount()

  await $.turn.start({ text: 'next', turnId: 'n' })
  const cleared = await $.ui.mount({ plugin: 'session-meter', surface: 'terminal', component: 'AbovePrompt', props })
  expect(await cleared.find({ type: 'Text', text: /handoff copied/ })).toBeUndefined()
  await cleared.unmount()
})

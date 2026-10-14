import { expect, mock, test } from 'claude-code/testing'

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 5, bodyColumns: 120, scroll: { offset: 0, bodyRows: 5 }, view: {} } } as const

// Draws the band with the context at `percent`; `coldMinutes` lets the cache go cold first.
async function draw($: any, on: any, percent: number, coldMinutes = 0) {
  const clock = mock.clock(on)
  mock.store(on)
  const toasts: string[] = []
  on('ui.toast', ($: any, e: any) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('session.id', () => ({ value: 'abc' }))
  on('session.cwd', () => ({ value: '/repo' }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: percent * 2_000, window: 200_000, percent }, rateLimits: [] } }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: '"ephemeral_1h_input_tokens":1200', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }))
  on('ui.render', ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return <Text>other band</Text>
  })
  on('turn.complete', () => ({ text: '' }))
  on('session.start', () => ({ cwd: '/repo' }))
  on('command.register', () => ({ value: undefined }))
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.turn.complete({ reason: 'answer', answer: 'done', turnId: 't', durationMs: 10, isAborted: false })
  if (coldMinutes) {
    await clock.advance(coldMinutes * 60_000)
    await clock.settle()
  }
  const ui = await $.ui.mount({ plugin: 'session-meter', surface: 'terminal', ...BAND })
  return { ui, toasts, tone: async () => (await ui.find({ type: 'Text', text: /ctx/ }))?.props.color }
}

test('defaults: 47% is amber with a handoff offer and one toast, not red', async ($, on) => {
  const { ui, toasts, tone } = await draw($, on, 47)
  expect(await tone()).toBe('warning')
  expect(await ui.find({ key: 'handoff' })).toBeDefined()
  expect(toasts).toHaveLength(1)
  await ui.unmount()
})

test('warnPercent decides the handoff offer and the toast', { options: { warnPercent: 80, yellowPercent: 90, redPercent: 95 } }, async ($, on) => {
  const { ui, toasts, tone } = await draw($, on, 47)
  expect(await ui.find({ key: 'handoff' })).toBeUndefined()
  expect(toasts).toHaveLength(0)
  expect(await tone()).toBeUndefined()
  await ui.unmount()
})

test('warnPercent also colors the figure', { options: { warnPercent: 40, yellowPercent: 90, redPercent: 95 } }, async ($, on) => {
  const { ui, tone } = await draw($, on, 47)
  expect(await tone()).toBe('warning')
  await ui.unmount()
})

test('yellowPercent decides where the color starts', { options: { yellowPercent: 50, warnPercent: 90, redPercent: 95 } }, async ($, on) => {
  const { ui, tone } = await draw($, on, 47)
  expect(await tone()).toBeUndefined()
  await ui.unmount()
})

test('yellowPercent below the context turns it yellow', { options: { yellowPercent: 40, warnPercent: 90, redPercent: 95 } }, async ($, on) => {
  const { ui, tone } = await draw($, on, 47)
  expect(await tone()).toBe('warning')
  await ui.unmount()
})

test('redPercent decides where red starts', { options: { redPercent: 47 } }, async ($, on) => {
  const { ui, tone } = await draw($, on, 47)
  expect(await tone()).toBe('error')
  await ui.unmount()
})

test('coldTipPercent decides the cold-cache tip', { options: { coldTipPercent: 80 } }, async ($, on) => {
  const { ui } = await draw($, on, 47, 90)
  expect(await ui.find({ type: 'Text', text: /rewrites/ })).toBeUndefined()
  await ui.unmount()
})

test('a cold cache at or over coldTipPercent shows the tip', { options: { coldTipPercent: 40 } }, async ($, on) => {
  const { ui } = await draw($, on, 47, 90)
  expect(await ui.find({ type: 'Text', text: /rewrites/ })).toBeDefined()
  await ui.unmount()
})

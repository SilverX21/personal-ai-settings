import { expect, mock, test } from 'claude-code/testing'

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 5, bodyColumns: 120, scroll: { offset: 0, bodyRows: 5 }, view: {} } } as const

test('band shows model, context and cache, and offers a handoff at 45%', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  const toasts: string[] = []
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('session.id', () => ({ value: 'abc' }))
  on('session.cwd', () => ({ value: '/repo' }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', () => ({
    value: { startedAt: 0, context: { tokens: 94_000, window: 200_000, percent: 47 }, rateLimits: [] },
  }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: '"ephemeral_1h_input_tokens":1200', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }))
  // Stands in for another plugin's band: ours must keep it, not replace it.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>other band</Text>
  })
  on('turn.complete', ($, e) => ({ text: e.reason === 'answer' ? e.answer : '' }))

  for (let i = 0; i < 2; i++) {
    await $.turn.complete({ reason: 'answer', answer: 'done', turnId: `t${i}`, durationMs: 10, isAborted: false })
  }

  const ui = await $.ui.mount({ plugin: 'session-meter', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Text', text: /other band/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Opus 5\.5/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /ctx 47%/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /cache Warm 60m/ })).toBeDefined()
  expect(await ui.find({ key: 'handoff' })).toBeDefined()
  expect(toasts.filter(t => t.includes('47%'))).toHaveLength(1)
  await ui.unmount()
})

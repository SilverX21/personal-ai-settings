import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

function answerSession(on: On, cwd: string, fills: string[]) {
  mock.clock(on)
  on('session.id', () => ({ value: 'new-session' }))
  on('session.cwd', () => ({ value: cwd }))
  on('session.model', () => ({ value: 'claude-sonnet-5-5' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 5_000, window: 200_000, percent: 2 }, rateLimits: [] } }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }))
  on('prompt.fill', ($, e) => {
    fills.push(e.text)
    return { isFilled: true }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('turn.complete', () => ({ text: '' }))
}

const pending = { text: 'HANDOFF', at: 0, fromSession: 'old-session', isUsed: false }

test('a saved handoff fills the empty prompt in a new session in the same folder, once', async ($, on) => {
  mock.store(on, { 'handoff:/repo': pending })
  const fills: string[] = []
  answerSession(on, '/repo', fills)
  for (const turnId of ['a', 'b']) {
    await $.turn.complete({ reason: 'answer', answer: '', turnId, durationMs: 1, isAborted: false })
  }
  expect(fills).toEqual(['HANDOFF'])
})

test('a handoff saved in another folder is not used', async ($, on) => {
  mock.store(on, { 'handoff:/other': pending })
  const fills: string[] = []
  answerSession(on, '/repo', fills)
  await $.turn.complete({ reason: 'answer', answer: '', turnId: 'a', durationMs: 1, isAborted: false })
  expect(fills).toEqual([])
})

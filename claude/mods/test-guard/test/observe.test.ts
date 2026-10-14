import type { Engine } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

const showLog = ($: Engine) =>
  $.command.run({
    command: 'test-guard',
    args: 'log',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 120 },
  })

test('observe mode runs a full-suite command unchanged and records it', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  on('session.cwd', () => ({ value: '/repo' }))
  const ran: string[] = []
  on('tool.call', { tool: 'Bash' }, ($, e) => {
    ran.push(e.command)
    return { result: 'ok' }
  })

  const result = await $.tool.call({ tool: 'Bash', command: 'pnpm test:all' })
  expect(result.deny).toBeUndefined()
  expect(ran).toEqual(['pnpm test:all'])

  const { text } = await showLog($)
  expect(text).toContain('pnpm test:all')
})

test('scoped commands are not recorded', async ($, on) => {
  mock.store(on)
  on('tool.call', { tool: 'Bash' }, () => ({ result: 'ok' }))
  await $.tool.call({ tool: 'Bash', command: 'pnpm exec vitest run src/a.test.tsx' })
  const { text } = await showLog($)
  expect(text).toContain('Nothing caught yet')
})

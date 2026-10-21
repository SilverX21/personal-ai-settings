import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

import { parseSize, restoreSize, splitInstruction } from '../hooks/dock-logic'

const REPORT = 'mcp__agent-dock__report_progress'

const PANE = {
  plugin: 'agent-dock',
  component: 'Pane',
  requestId: 'agent-dock',
  props: {
    title: 'Agent Dock',
    isFocused: false,
    bodyColumns: 76,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 60 },
    view: {},
  },
} as const

const PRESENT = { isFullscreen: true, columns: 160 } as const

type Boot = { store?: Record<string, unknown>; env?: Record<string, string>; agentMs?: number }

// Nothing sits beneath the plugin in a test: these hooks stand for the engine,
// all registered before the test's first call on $.
async function boot($: Engine, on: On, { store = {}, env = {}, agentMs = 0 }: Boot = {}) {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on, store)
  mock.env(on, { HOME: '/home/test', ...env })
  const status: Array<string | undefined> = []
  const contexts: Array<readonly string[] | undefined> = []
  const nudges: string[] = []
  let isPaneOpen = false
  on('tool.register', (_, e) => ({ value: { tool: `mcp__agent-dock__${e.name}` } }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.status', (_, e) => {
    status.push(e.text)
    return { value: undefined }
  })
  on('ui.open', () => {
    isPaneOpen = true
    return { value: { isPlaced: true } }
  })
  on('ui.close', () => {
    isPaneOpen = false
    return { value: undefined }
  })
  on('ui.panes', () => ({
    value: isPaneOpen ? [{ id: 'agent-dock', title: 'Agent Dock', isShown: true, isFocused: false, isPlaced: true }] : [],
  }))
  on('session.id', () => ({ value: 'session-1' }))
  on('fs.write', () => ({ value: undefined }))
  on('agent.list', () => ({
    value: [{ id: 'agent-b', description: 'Price check: Crumbl', type: 'general-purpose', status: 'running' }],
  }))
  on('model.complete', () => ({
    value: { isAnswered: false, reason: 'empty-reply', usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } },
  }))
  on('prompt.submit', (_, e) => {
    if (e.origin?.kind === 'plugin') {
      nudges.push(e.text)
    } else {
      contexts.push(e.context)
    }
    return { text: e.text, context: e.context }
  })
  // The dock's one-second wait for a free slot, on the test's clock.
  on('process.run', async () => {
    await clock.sleep(1000)
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  // Each helper takes agentMs on the test's clock.
  on('tool.call', async (_, e) => {
    if (agentMs > 0 && String(e.tool) === 'Agent') {
      await clock.sleep(agentMs)
    }
    return { result: {} }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: '' }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  return {
    clock,
    status,
    contexts,
    nudges,
    isPaneOpen: () => isPaneOpen,
  }
}

const send = ($: Engine, text: string) => $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } })

async function setSize($: Engine, clock: { advance: (ms: number) => Promise<void> }, size: number) {
  await $.command.run({ command: 'dock', args: String(size), origin: { kind: 'composer' }, presentation: PRESENT })
  // The command answers at once and sets the size just after.
  await clock.advance(0)
}

const agentCall = (description: string) => ({ tool: 'Agent' as const, description, prompt: 'Do the thing' })

test('1. parseSize takes whole numbers from 1 to 100 only', () => {
  expect(parseSize('10')).toBe(10)
  expect(parseSize(' 25 ')).toBe(25)
  for (const bad of ['0', '101', 'abc', '2.5']) {
    expect(parseSize(bad)).toBe(null)
  }
})

test('2. a saved 50 comes back as 1 in a new session; 10 stays 10', async ($, on) => {
  expect(restoreSize(50)).toBe(1)
  expect(restoreSize(10)).toBe(10)

  await boot($, on, { store: { 'dock.size': 50 } })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /Claude decides how many helpers/ })).toBeDefined()
    await ui.unmount()
  }
})

test('3. size 5 adds the exactly-5 instruction; size 1 adds nothing', async ($, on) => {
  const { clock, contexts } = await boot($, on)
  await send($, 'Research bakery pricing in my town')
  expect(contexts[0]).toBeUndefined()

  await setSize($, clock, 5)
  await send($, 'Research bakery pricing in my town')
  expect(contexts[1]).toEqual([splitInstruction(5)])
  expect(contexts[1]?.[0]).toContain('exactly 5')
})

test('4. the 6th Agent call at size 5 is denied', async ($, on) => {
  const { clock } = await boot($, on)
  await setSize($, clock, 5)
  await send($, 'Compare five gyms near me')
  for (let i = 1; i <= 5; i += 1) {
    const ran = await $.tool.call(agentCall(`Check gym ${i}`))
    expect(ran.deny).toBeUndefined()
  }
  const sixth = await $.tool.call(agentCall('Check gym 6'))
  expect(sixth.deny).toBe('Team Size is 5: this request already has 5 helpers. Finish with the helpers you have.')
})

test('5. a request that used 3 of 10 gets exactly one nudge', async ($, on) => {
  const { clock, nudges } = await boot($, on)
  await setSize($, clock, 10)
  await send($, 'Plan my product launch')
  for (const name of ['Write the email', 'Draft the post', 'Make the deck']) {
    await $.tool.call(agentCall(name))
  }
  await $.turn.complete({ turnId: 't1', reason: 'answer', answer: 'Done' } as never)
  await $.turn.complete({ turnId: 't2', reason: 'answer', answer: 'Done again' } as never)
  expect(nudges).toEqual([
    'You used 3 of 10 helpers. Split the remaining work across the other 7, one helper per piece, all in parallel.',
  ])
})

test('6 and 7. cards go queued, working, done; a report moves its meter; the summary shows', async ($, on) => {
  const { clock } = await boot($, on, {
    env: { CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS: '2', CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY: '2' },
    agentMs: 5000,
  })
  await setSize($, clock, 3)
  await send($, 'Research bakery pricing, then sum it up')

  const calls = ['Price check: Panera', 'Price check: Crumbl', 'Price check: Paris Baguette'].map(name =>
    $.tool.call(agentCall(name)),
  )
  await clock.advance(0)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Research bakery pricing/ })).toBeDefined()
  expect((await ui.findAll({ type: 'Text', text: /^\s*queued$/ })).length).toBe(1)
  expect((await ui.findAll({ type: 'Text', text: /^● 2 working$/ })).length).toBe(1)

  const noted = await $.tool.call({ tool: REPORT, task: 'Price check: Crumbl', percent: 60, agentId: 'agent-b' } as never)
  expect(noted.result).toBe('Progress noted: 60%.')
  expect(await ui.find({ type: 'Text', text: /^\s*60%$/ })).toBeDefined()

  // Two finish at 5s, the third takes the free slot and finishes by 12s.
  await clock.advance(12_000)
  await Promise.all(calls)
  await $.turn.complete({ turnId: 't1', reason: 'answer', answer: 'Here is the pricing' } as never)

  expect((await ui.findAll({ type: 'Text', text: /^\s+100%$/ })).length).toBe(3)
  expect(await ui.find({ type: 'Text', text: /3 agents finished Research bakery pricing in / })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /C O M P L E T E/ })).toBeDefined()
  await ui.unmount()
})

test('8. /dock folds to the badge and back', async ($, on) => {
  const { clock, status, isPaneOpen } = await boot($, on)
  const run = () => $.command.run({ command: 'dock', args: '', origin: { kind: 'composer' }, presentation: PRESENT })

  await run()
  await clock.advance(0)
  expect(isPaneOpen()).toBe(true)

  await run()
  await clock.advance(0)
  expect(isPaneOpen()).toBe(false)
  expect(status.at(-1)).toBe('◆ Dock · team of 1 standing by')

  await run()
  await clock.advance(0)
  expect(isPaneOpen()).toBe(true)
  expect(status.at(-1)).toBe(undefined)
})

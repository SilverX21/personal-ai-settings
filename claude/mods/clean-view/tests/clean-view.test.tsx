import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

import { cleanName } from '../hooks/clean-view'

const PLAN = 'mcp__clean-view__plan_steps'
const REPORT = 'mcp__clean-view__report_progress'
const LABEL = /^\s+(Done|Working|Next|Up next|\d+%)$/

const BAND = {
  plugin: 'clean-view',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: true,
    maxRows: 20,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

// Nothing sits beneath the plugin in a test: these hooks stand for the engine.
async function boot($: Engine, on: On) {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  on('tool.register', (_, e) => ({ value: { tool: `mcp__clean-view__${e.name}` } }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.toast', () => ({ value: undefined }))
  on('model.complete', () => ({
    value: {
      isAnswered: true,
      text: 'Build my landing page',
      usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    },
  }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: {} }))
  on('classic.Notification', () => ({}))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  return clock
}

test('1. step names come out plain and short', () => {
  expect(cleanName('Build the pricing section in `src/Pricing.tsx`')).toBe('Build the pricing section in')
  expect(cleanName('update the header in src/app/Header and the logo')).toBe('Update the header in and the logo')
  expect(cleanName('Fix Pricing.tsx styles')).toBe('Fix styles')
  const long = cleanName(
    'Rewrite every paragraph of the about page so it sounds warmer and more welcoming',
  )
  expect(long.length <= 40).toBe(true)
  expect(long.endsWith('…')).toBe(true)
  expect(cleanName('`npm run build`')).toBe('Working on it')
})

test('2. a to-do list and a 60% report draw the checklist, on terminal and desktop', async ($, on) => {
  const clock = await boot($, on)
  await $.turn.start({ text: 'Make me a landing page', turnId: 't1' })
  await clock.advance(1)
  await $.tool.call({
    tool: 'TodoWrite',
    todos: [
      { content: 'Read your brand notes', status: 'completed', activeForm: 'Reading' },
      { content: 'Build the pricing section', status: 'in_progress', activeForm: 'Building' },
      { content: 'Add the contact form', status: 'pending', activeForm: 'Adding' },
      { content: 'Polish the footer', status: 'pending', activeForm: 'Polishing' },
    ],
  })
  await $.tool.call({ tool: REPORT, task: 'Build the pricing section', percent: 60 })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: /Build my landing page · / })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /✓/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /▶/ })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /██████░░░░/ }))?.text).toContain('██████░░░░')
    const labels = (await ui.findAll({ type: 'Text', text: LABEL })).map(one => one.text.trim())
    expect(labels).toEqual(['Done', '60%', 'Next', 'Up next'])
    expect(await ui.find({ type: 'Button', key: 'clean-view-toggle' })).toBeDefined()
    await ui.unmount()
  }
})

test('3. a permission prompt shows Needs you', async ($, on) => {
  await boot($, on)
  await $.turn.start({ text: 'Tidy my notes', turnId: 't1' })
  await $.tool.call({ tool: PLAN, steps: ['Read your notes', 'Tidy them up'] })
  await $.classic.Notification({ message: 'Claude needs your permission', notification_type: 'permission_prompt' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: /Needs you/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /needs your OK/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /‖/ })).toBeDefined()
    await ui.unmount()
  }
})

test('4. /simple off hides the band and keeps the button', async ($, on) => {
  await boot($, on)
  await $.turn.start({ text: 'Tidy my notes', turnId: 't1' })
  await $.tool.call({ tool: PLAN, steps: ['Read your notes', 'Tidy them up'] })
  const said = await $.command.run({
    command: 'simple',
    args: 'off',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })
  expect(said.text).toBe('Clean View is off.')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: /Read your notes/ })).toBeUndefined()
    expect((await ui.find({ type: 'Button', key: 'clean-view-toggle' }))?.text).toContain('OFF')
    await ui.press({ key: 'clean-view-toggle' })
    expect(await ui.find({ type: 'Text', text: /Read your notes/ })).toBeDefined()
    await ui.press({ key: 'clean-view-toggle' })
    await ui.unmount()
  }
})

test('5. finishing step one starts step two', async ($, on) => {
  await boot($, on)
  await $.turn.start({ text: 'Plan my week', turnId: 't1' })
  const planned = await $.tool.call({ tool: PLAN, steps: ['Look at your calendar', 'Pick the free slots', 'Write the plan'] })
  expect(planned.result).toBe('Planned 3 steps. The first one has started.')
  const noted = await $.tool.call({ tool: REPORT, task: 'Look at your calendar', percent: 140 })
  expect(noted.result).toBe('Progress noted: 100%.')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const labels = (await ui.findAll({ type: 'Text', text: LABEL })).map(one => one.text.trim())
    expect(labels).toEqual(['Done', 'Working', 'Next'])
    expect((await ui.find({ type: 'Text', text: /Pick the free slots/ }))?.props.bold).toBe(true)
    await ui.unmount()
  }
})

test('6. tools are refused before a plan and allowed after', async ($, on) => {
  await boot($, on)
  await $.turn.start({ text: 'Fix my website', turnId: 't1' })

  const before = await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(String(before.deny ?? before.text)).toContain('plan_steps')
  const search = await $.tool.call({ tool: 'ToolSearch', query: 'select:plan_steps', max_results: 1 })
  expect(search.deny).toBeUndefined()

  await $.tool.call({ tool: PLAN, steps: ['Find the problem', 'Fix it'] })
  const after = await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(after.deny).toBeUndefined()
  expect(after.isError).toBeUndefined()
})

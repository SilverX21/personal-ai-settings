import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { decideIntercept, parseQuestions, parseRewrite } from '../hooks/logic'

const PLUGIN = 'prompt-upgrade'
const USAGE = { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }

const QUESTIONS = JSON.stringify({
  questions: [
    { q: 'Who is it for?', options: ['Developers', 'Managers'] },
    { q: 'What format?', options: ['Bullet list', 'Short report', 'Table'] },
  ],
})
const REWRITE = JSON.stringify({
  prompt: 'Write a short report for developers on [topic], as a bullet list.',
  added: ['Audience: developers', 'Format: bullet list'],
})

const pane = (surface: 'terminal' | 'desktop', bodyColumns: number) =>
  ({
    plugin: PLUGIN,
    surface,
    component: 'Pane',
    requestId: PLUGIN,
    props: {
      title: 'Prompt Upgrade',
      isFocused: true,
      bodyColumns,
      placement: 'dock',
      scroll: { offset: 0, bodyRows: 60 },
      view: {},
    },
  }) as const

type World = { submitted: string[]; filled: string[]; closed: number; modelCalls: string[] }

function engine(on: On, replies: { questions?: string; rewrite?: string } = {}): World {
  const world: World = { submitted: [], filled: [], closed: 0, modelCalls: [] }
  mock.store(on)
  on('command.register', () => ({ value: { command: 'better' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => {
    world.closed += 1
    return { value: undefined }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.fill', (_, e) => {
    world.filled.push(e.text)
    return { isFilled: true }
  })
  on('prompt.submit', (_, e) => {
    world.submitted.push(e.text)
    return { text: e.text }
  })
  on('model.complete', (_, e) => {
    world.modelCalls.push(e.model)
    const text = e.model === 'haiku' ? (replies.questions ?? QUESTIONS) : (replies.rewrite ?? REWRITE)
    return { value: { isAnswered: true, text, usage: USAGE } }
  })

  return world
}

const better = (args: string) => ({
  command: 'better',
  args,
  origin: { kind: 'composer' as const },
  presentation: { isFullscreen: true, columns: 160 },
})

const typed = (text: string) => ({ text, wait: false, origin: { kind: 'composer' as const } })

describe('which prompts are intercepted', () => {
  const base = {
    originKind: 'composer',
    isAuto: true,
    hasCommand: false,
    hasAttachments: false,
    isBusy: false,
    isMeta: false,
  }
  const long = 'write a report about our sensors'

  test('a typed prompt is intercepted while automatic mode is on', () => {
    expect(decideIntercept({ ...base, text: long })).toEqual({ kind: 'intercept' })
  })
  test('everything else passes untouched', () => {
    expect(decideIntercept({ ...base, text: long, isAuto: false }).kind).toBe('pass')
    expect(decideIntercept({ ...base, text: '/compact now please ok' }).kind).toBe('pass')
    expect(decideIntercept({ ...base, text: long, hasCommand: true }).kind).toBe('pass')
    expect(decideIntercept({ ...base, text: long, hasAttachments: true }).kind).toBe('pass')
    expect(decideIntercept({ ...base, text: long, isBusy: true }).kind).toBe('pass')
    expect(decideIntercept({ ...base, text: long, originKind: 'plugin' }).kind).toBe('pass')
    expect(decideIntercept({ ...base, text: 'yes' }).kind).toBe('pass')
    expect(decideIntercept({ ...base, text: 'keep going' }).kind).toBe('pass')
  })
  test('a leading ">" is stripped and sent as is', () => {
    expect(decideIntercept({ ...base, text: '> send this exactly as written' })).toEqual({
      kind: 'strip',
      text: 'send this exactly as written',
    })
  })
})

describe('reading the model', () => {
  test('questions are read, capped and cleaned', () => {
    const text = '```json\n' + JSON.stringify({
      questions: [
        { q: 'A?', options: ['x', 'y', 'z', 'w', 'v'] },
        { q: 'B?', options: ['only one'] },
        { q: 'C?', options: ['a', 'b'] },
        { q: 'D?', options: ['a', 'b'] },
        { q: 'E?', options: ['a', 'b'] },
      ],
    }) + '\n```'
    const questions = parseQuestions(text)
    expect(questions).toHaveLength(3)
    expect(questions?.[0]?.options).toHaveLength(4)
    expect(questions?.map(q => q.q)).toEqual(['A?', 'C?', 'D?'])
    expect(parseQuestions('{"questions":[]}')).toEqual([])
    expect(parseQuestions('not json')).toBe(undefined)
  })
  test('the rewrite is read with what it added', () => {
    expect(parseRewrite(`Here you go: ${REWRITE}`)).toEqual(JSON.parse(REWRITE))
    expect(parseRewrite('{"added":["x"]}')).toBe(undefined)
  })
})

for (const [surface, cols] of [['terminal', 44], ['desktop', 120]] as const) {
  test(`the full flow from /better to Run on ${surface} at ${cols} columns`, async ($, on) => {
    const world = engine(on)
    const clock = mock.clock(on)
    await $.session.start({ cwd: '/', surface, isInteractive: true })

    const answer = await $.command.run(better('write a report about sensors'))
    expect(answer.text).toContain('Prompt Upgrade')
    await clock.settle()

    const ui = await $.ui.mount(pane(surface, cols))
    expect((await ui.find({ type: 'Text', text: 'Who is it for?' }))?.text).toBe('Who is it for?')
    expect(await ui.find({ key: 'skip-rest' })).toBeDefined()

    await ui.press({ key: 'q0-o0' })
    await ui.press({ key: 'q1-o0' })
    await clock.settle()
    await ui.redraw()

    expect(world.modelCalls).toEqual(['haiku', 'sonnet'])
    expect(await ui.find({ key: 'run' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Audience: developers' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /\[topic\]/ })).toBeDefined()

    await ui.press({ key: 'run' })
    expect(world.submitted).toEqual([JSON.parse(REWRITE).prompt])
    expect(world.closed).toBeGreaterThan(0)
    await ui.unmount()

    const history = await $.ui.mount(pane(surface, cols))
    await $.command.run(better('history'))
    await history.redraw()
    expect(await history.find({ type: 'Text', text: /write a report about sensors/ })).toBeDefined()
    await history.unmount()
  })
}

test('Cancel closes the pane and puts the original back', async ($, on) => {
  const world = engine(on)
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run(better('fix the flaky login test please'))
  await clock.settle()

  const ui = await $.ui.mount(pane('terminal', 80))
  await ui.press({ key: 'cancel' })
  expect(world.filled).toEqual(['fix the flaky login test please'])
  expect(world.submitted).toEqual([])
  await ui.unmount()
})

test('no questions goes straight to the rewrite', async ($, on) => {
  const world = engine(on, { questions: '{"questions":[]}' })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run(better('summarise the changelog for the team'))
  await clock.settle()

  const ui = await $.ui.mount(pane('desktop', 100))
  expect(world.modelCalls).toEqual(['haiku', 'sonnet'])
  expect(await ui.find({ key: 'run' })).toBeDefined()
  await ui.unmount()
})

test('a failed model call shows the error card and can send the original', async ($, on) => {
  const world = engine(on, { questions: 'no json here' })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run(better('plan the database migration steps'))
  await clock.settle()

  const ui = await $.ui.mount(pane('terminal', 60))
  expect(await ui.find({ type: 'Text', text: /prompt is safe/ })).toBeDefined()
  await ui.press({ key: 'send-original' })
  expect(world.submitted).toEqual(['plan the database migration steps'])
  await ui.unmount()
})

test('the on and off switch decides whether typed prompts are intercepted', async ($, on) => {
  const world = engine(on)
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  await $.prompt.submit(typed('write a design doc for alerts'))
  expect(world.submitted).toEqual(['write a design doc for alerts'])

  await $.command.run(better('on'))
  const held = await $.prompt.submit(typed('write a design doc for dashboards'))
  expect(held.drop).toBeDefined()
  expect(world.submitted).toHaveLength(1)
  await clock.settle()

  await $.prompt.submit(typed('yes'))
  await $.prompt.submit(typed('> send this one exactly please'))
  expect(world.submitted.slice(1)).toEqual(['yes', 'send this one exactly please'])

  await $.command.run(better('off'))
  await $.prompt.submit(typed('write a design doc for reports'))
  expect(world.submitted.at(-1)).toBe('write a design doc for reports')
})

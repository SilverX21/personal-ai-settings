import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const TEXT = Array.from({ length: 30 }, (_, i) => `word${i}`).join(' ')
const IMPROVED = 'Goal: do the thing\nContext: [?: which repo]'
const submit = ($: { prompt: { submit: (i: never) => Promise<{ text?: string; drop?: string }> } }, text = TEXT) =>
  $.prompt.submit({ wait: false, origin: { kind: 'composer' }, text } as never)

// Answers each dialog in order from `labels`; a label of null denies it, as a dismissal.
function answers(on: On, labels: (string | null)[], questions: string[] = []) {
  let i = 0
  on('tool.call', { tool: 'AskUserQuestion' }, ($, e) => {
    const q = e.questions[0]!.question
    questions.push(q)
    const label = labels[i++] ?? null
    return label === null ? { deny: 'dismissed' } : { result: { questions: e.questions, answers: { [q]: label } } }
  })
}

const model = (on: On, reply: unknown, seen: unknown[] = []) =>
  on('model.complete', (_$, e) => {
    seen.push(e)
    return { value: reply } as never
  })
const answered = (text: string) => ({ isAnswered: true, text, usage: { input_tokens: 1, output_tokens: 1 } })

// mock.store seeds but cannot be read back, so the toggle round-trips through an own map.
function memStore(on: On) {
  const kv = new Map<string, unknown>()
  on('store.get', (_$, e) => ({ value: kv.get(e.key) }) as never)
  on('store.set', (_$, e) => {
    kv.set(e.key, e.value)
    return { value: undefined } as never
  })
}

function capture(on: On, seen: string[]) {
  on('prompt.submit', (_$, e) => {
    seen.push(e.text)
    return { text: e.text }
  })
}

async function enable($: { command: { run: (i: never) => Promise<unknown> } }) {
  await $.command.run({ command: 'enhance', args: 'on' } as never)
}

test('off by default: a long prompt passes through with no dialog', async ($, on) => {
  memStore(on)
  const seen: string[] = []
  const asked: string[] = []
  answers(on, [], asked)
  capture(on, seen)
  await submit($ as never)
  expect(seen).toEqual([TEXT])
  expect(asked).toEqual([])
})

test('/enhance on and off toggle, a bad argument only prints the state', async ($, on) => {
  memStore(on)
  const r1 = await $.command.run({ command: 'enhance', args: 'on' } as never)
  expect(JSON.stringify(r1)).toContain('is on')
  const r2 = await $.command.run({ command: 'enhance', args: 'maybe' } as never)
  expect(JSON.stringify(r2)).toContain('is on. Use')
  const r3 = await $.command.run({ command: 'enhance', args: 'off' } as never)
  expect(JSON.stringify(r3)).toContain('is off')
})

test('a short reply never asks', async ($, on) => {
  memStore(on)
  const asked: string[] = []
  answers(on, [], asked)
  capture(on, [])
  await enable($ as never)
  await submit($ as never, 'yes go')
  expect(asked).toEqual([])
})

test('Dismiss sends the original and never calls the model', async ($, on) => {
  memStore(on)
  const seen: string[] = []
  const calls: unknown[] = []
  answers(on, ['Dismiss'])
  model(on, answered(IMPROVED), calls)
  capture(on, seen)
  await enable($ as never)
  await submit($ as never)
  expect(seen).toEqual([TEXT])
  expect(calls).toEqual([])
})

test('a dismissed first dialog sends the original', async ($, on) => {
  memStore(on)
  const seen: string[] = []
  answers(on, [null])
  capture(on, seen)
  await enable($ as never)
  await submit($ as never)
  expect(seen).toEqual([TEXT])
})

test('Improve calls Haiku with the template, the rules and the wrapped text', async ($, on) => {
  memStore(on)
  const calls: { model: string; system?: string; prompt: string; timeoutMs?: number }[] = []
  answers(on, ['Improve prompt', 'Send original'])
  model(on, answered(IMPROVED), calls)
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  await enable($ as never)
  await submit($ as never)
  expect(calls.length).toBe(1)
  expect(calls[0]!.model).toBe('claude-haiku-5-5')
  expect(calls[0]!.prompt).toBe(`<prompt>\n${TEXT}\n</prompt>`)
  expect(calls[0]!.system).toContain('Acceptance criteria')
  expect(calls[0]!.timeoutMs).toBe(20_000)
})

test('Send improved replaces the text and the improved text is in the dialog body', async ($, on) => {
  memStore(on)
  const seen: string[] = []
  const asked: string[] = []
  answers(on, ['Improve prompt', 'Send improved'], asked)
  model(on, answered(IMPROVED))
  capture(on, seen)
  await enable($ as never)
  await submit($ as never)
  expect(seen).toEqual([IMPROVED])
  expect(asked[1]).toContain(IMPROVED)
})

test('Send original keeps the text', async ($, on) => {
  memStore(on)
  const seen: string[] = []
  answers(on, ['Improve prompt', 'Send original'])
  model(on, answered(IMPROVED))
  capture(on, seen)
  await enable($ as never)
  await submit($ as never)
  expect(seen).toEqual([TEXT])
})

test('a dismissed second dialog sends the original', async ($, on) => {
  memStore(on)
  const seen: string[] = []
  answers(on, ['Improve prompt', null])
  model(on, answered(IMPROVED))
  capture(on, seen)
  await enable($ as never)
  await submit($ as never)
  expect(seen).toEqual([TEXT])
})

test('Edit drops the submit and fills the improved text', async ($, on) => {
  memStore(on)
  const clock = mock.clock(on)
  const seen: string[] = []
  const filled: string[] = []
  answers(on, ['Improve prompt', 'Edit'])
  model(on, answered(IMPROVED))
  capture(on, seen)
  on('prompt.fill', (_$, e) => {
    filled.push(e.text)
    return { isFilled: true }
  })
  await enable($ as never)
  const result = await submit($ as never)
  await clock.advance(300)
  await clock.settle()
  expect(result.drop).toContain('Improved prompt')
  expect(seen).toEqual([])
  expect(filled).toEqual([IMPROVED])
})

test('Edit fills the full text even when the dialog body was shortened', async ($, on) => {
  memStore(on)
  const clock = mock.clock(on)
  const long = `Goal: ${'x'.repeat(3000)}`
  const asked: string[] = []
  const filled: string[] = []
  answers(on, ['Improve prompt', 'Edit'], asked)
  model(on, answered(long))
  capture(on, [])
  on('prompt.fill', (_$, e) => {
    filled.push(e.text)
    return { isFilled: true }
  })
  await enable($ as never)
  await submit($ as never)
  await clock.advance(300)
  await clock.settle()
  expect(asked[1]).toContain('(shortened)')
  expect(asked[1]!.length).toBeLessThan(long.length)
  expect(filled).toEqual([long])
})

for (const [name, reply] of [
  ['an API error', { isAnswered: false, reason: 'api-error', status: 500, error: 'boom', usage: {} }],
  ['a timeout', { isAnswered: false, reason: 'aborted', usage: {} }],
  ['an empty reply', answered('')],
  ['a blank reply', answered('  \n ')],
] as const) {
  test(`${name} sends the original with one toast`, async ($, on) => {
    memStore(on)
    const seen: string[] = []
    const toasts: string[] = []
    const asked: string[] = []
    answers(on, ['Improve prompt'], asked)
    model(on, reply)
    capture(on, seen)
    on('ui.toast', (_$, e) => {
      toasts.push(e.text)
      return { value: undefined } as never
    })
    await enable($ as never)
    await submit($ as never)
    expect(seen).toEqual([TEXT])
    expect(toasts.length).toBe(1)
    expect(asked.length).toBe(1)
  })
}

test('a model call that rejects also sends the original', async ($, on) => {
  memStore(on)
  const seen: string[] = []
  answers(on, ['Improve prompt'])
  on('model.complete', () => ({ deny: 'blocked' }) as never)
  capture(on, seen)
  await enable($ as never)
  await submit($ as never)
  expect(seen).toEqual([TEXT])
})

test('a notification prompt is never offered a rewrite', async ($, on) => {
  memStore(on)
  const asked: string[] = []
  answers(on, [], asked)
  capture(on, [])
  await enable($ as never)
  await $.prompt.submit({ wait: false, origin: { kind: 'task-notification' }, text: TEXT } as never)
  expect(asked).toEqual([])
})

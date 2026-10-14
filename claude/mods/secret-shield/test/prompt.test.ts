import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const SECRET = 'Fq8vR2kLm9Tz_Wp4Hx7Nc-3Jd6Gb1Ys5Ea0Ku8Oi2Pq'

function answerAsk(on: On, label: string) {
  on('tool.call', { tool: 'AskUserQuestion' }, ($, e) => ({
    result: { questions: e.questions, answers: { [e.questions[0]!.question]: label } },
  }))
}

function capturePrompts(on: On, seen: string[]) {
  on('prompt.submit', ($, e) => {
    seen.push(e.text)
    return { text: e.text }
  })
}

test('Redact & send replaces the secret before the prompt enters', async ($, on) => {
  const seen: string[] = []
  answerAsk(on, 'Redact & send')
  capturePrompts(on, seen)
  await $.prompt.submit({ wait: false, origin: { kind: 'composer' }, text: `use the api secret ${SECRET} please` })
  expect(seen).toEqual(['use the api secret <REDACTED:high-entropy> please'])
})

test('Send anyway keeps the prompt as typed', async ($, on) => {
  const seen: string[] = []
  answerAsk(on, 'Send anyway')
  capturePrompts(on, seen)
  await $.prompt.submit({ wait: false, origin: { kind: 'composer' }, text: `secret ${SECRET}` })
  expect(seen).toEqual([`secret ${SECRET}`])
})

test('a prompt without secrets never asks', async ($, on) => {
  const seen: string[] = []
  capturePrompts(on, seen)
  await $.prompt.submit({ wait: false, origin: { kind: 'composer' }, text: 'pull US #12345 and its tasks' })
  expect(seen).toEqual(['pull US #12345 and its tasks'])
})

test('Cancel drops the prompt', async ($, on) => {
  const seen: string[] = []
  answerAsk(on, 'Cancel')
  capturePrompts(on, seen)
  on('prompt.fill', () => ({ isFilled: true }))
  const result = await $.prompt.submit({ wait: false, origin: { kind: 'composer' }, text: `secret ${SECRET}` })
  expect(result.drop).toContain('not sent')
  expect(seen).toEqual([])
})

const run = (exitCode: number) => ({ value: { exitCode, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
const WRITE = { tool: 'Write', file_path: '/repo/appsettings.json', content: '{ "Db": "Host=db;Password=s3cretPass;" }' } as const

test('a secret written to a git-tracked file is denied on Cancel', async ($, on) => {
  answerAsk(on, 'Cancel')
  on('process.run', () => run(1))
  on('tool.call', { tool: 'Write' }, () => ({ result: 'written' }))
  const result = await $.tool.call(WRITE)
  expect(result.deny).toContain('secret-shield')
})

test('a gitignored file is written without asking', async ($, on) => {
  on('process.run', () => run(0))
  const written: string[] = []
  on('tool.call', { tool: 'Write' }, ($, e) => {
    written.push(e.content)
    return { result: 'written' }
  })
  await $.tool.call(WRITE)
  expect(written).toEqual([WRITE.content])
})

test('a field named like a secret is caught without any config', async ($, on) => {
  const seen: string[] = []
  answerAsk(on, 'Redact & send')
  capturePrompts(on, seen)
  await $.prompt.submit({ wait: false, origin: { kind: 'composer' }, text: 'x-acme-token: abcd1234efgh5678' })
  expect(seen).toEqual(['x-acme-token: <REDACTED:named-secret>'])
})

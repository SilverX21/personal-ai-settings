import type { Answer, Question } from '../types'

export const SHORT_REPLY_WORDS = 3

export type InterceptInput = {
  text: string
  originKind: string
  isAuto: boolean
  hasCommand: boolean
  hasAttachments: boolean
  isBusy: boolean
  isMeta: boolean
}

export type InterceptDecision =
  | { kind: 'pass' }
  | { kind: 'strip'; text: string }
  | { kind: 'intercept' }

export function decideIntercept(input: InterceptInput): InterceptDecision {
  if (!input.isAuto || input.originKind !== 'composer') return { kind: 'pass' }
  if (input.hasCommand || input.isMeta || input.hasAttachments || input.isBusy) {
    return { kind: 'pass' }
  }

  const trimmed = input.text.trim()
  if (trimmed.startsWith('/')) return { kind: 'pass' }
  if (trimmed.startsWith('>')) return { kind: 'strip', text: trimmed.slice(1).trimStart() }
  if (countWords(trimmed) <= SHORT_REPLY_WORDS) return { kind: 'pass' }

  return { kind: 'intercept' }
}

export function countWords(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean)

  return words.length
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced?.[1] ?? text
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) return undefined
  try {
    return JSON.parse(body.slice(start, end + 1))
  } catch {
    return undefined
  }
}

const isString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0

export function parseQuestions(text: string): Question[] | undefined {
  const data = extractJson(text)
  if (data === undefined || typeof data !== 'object' || data === null) return undefined
  const raw = (data as { questions?: unknown }).questions
  if (!Array.isArray(raw)) return undefined

  const questions: Question[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const q = (item as { q?: unknown; question?: unknown }).q ?? (item as { question?: unknown }).question
    const options = (item as { options?: unknown }).options
    if (!isString(q) || !Array.isArray(options)) continue
    const clean = [...new Set(options.filter(isString).map(o => o.trim()))].slice(0, 4)
    if (clean.length < 2) continue
    questions.push({ q: q.trim(), options: clean })
    if (questions.length === 3) break
  }

  return questions
}

export function parseRewrite(text: string): { prompt: string; added: string[] } | undefined {
  const data = extractJson(text)
  if (data !== undefined && typeof data === 'object' && data !== null) {
    const prompt = (data as { prompt?: unknown }).prompt
    const added = (data as { added?: unknown }).added
    if (isString(prompt)) {
      return {
        prompt: prompt.trim(),
        added: Array.isArray(added) ? added.filter(isString).map(a => a.trim()).slice(0, 8) : [],
      }
    }
  }

  return undefined
}

export const QUESTIONS_SYSTEM = [
  'You help a person sharpen a rough prompt before they send it to an AI coding assistant.',
  'Pick at most three multiple-choice questions whose answers would most improve the result.',
  'Each question is one short sentence with two to four short options (five words or fewer each).',
  'Never ask about something the prompt already states. If no question would clearly help, return none.',
  'Reply with JSON only, no prose: {"questions":[{"q":"...","options":["...","..."]}]}',
].join('\n')

export const REWRITE_SYSTEM = [
  'You rewrite a rough prompt into a clear, complete one the person could have typed themselves.',
  'Rules:',
  '- Keep exactly what they meant. Do not change the task.',
  '- Add a clear goal, who it is for, the format of the result, and what "done" looks like.',
  '- Use the answers they gave. Leave out anything they skipped.',
  '- Never invent facts, names, numbers or prices. Where something is unknown, write a [placeholder] in square brackets.',
  '- Write one request in plain language, first person, no headings about yourself, no preamble.',
  'Reply with JSON only: {"prompt":"the upgraded prompt","added":["short phrase for each thing you added"]}',
].join('\n')

export function questionsPrompt(original: string): string {
  return `The rough prompt:\n"""\n${original}\n"""`
}

export function rewritePrompt(original: string, questions: Question[], answers: Record<string, Answer>): string {
  const lines = questions.flatMap((question, i) => {
    const answer = answers[String(i)]
    if (answer === undefined || 'skipped' in answer) return []

    return [`- ${question.q} -> ${answer.choice}`]
  })
  const answered = lines.length > 0 ? `\n\nTheir answers:\n${lines.join('\n')}` : '\n\nThey gave no extra answers.'

  return `The rough prompt:\n"""\n${original}\n"""${answered}`
}

const DIGITS: Record<string, [string, string, string]> = {
  '0': ['┏━┓', '┃ ┃', '┗━┛'],
  '1': ['╺┓ ', ' ┃ ', '╺┻╸'],
  '2': ['╺━┓', '┏━┛', '┗━╸'],
  '3': ['╺━┓', ' ━┫', '╺━┛'],
  '4': ['╻ ╻', '┗━┫', '  ╹'],
  '5': ['┏━╸', '┗━┓', '╺━┛'],
  '6': ['┏━╸', '┣━┓', '┗━┛'],
  '7': ['╺━┓', '  ┃', '  ╹'],
  '8': ['┏━┓', '┣━┫', '┗━┛'],
  '9': ['┏━┓', '┗━┫', '╺━┛'],
}

export function bigNumber(n: number): [string, string, string] {
  const digits = String(Math.max(0, Math.round(n))).split('')
  const rows: [string, string, string] = ['', '', '']
  digits.forEach((d, i) => {
    const glyph = DIGITS[d] ?? DIGITS['0']!
    const gap = i === 0 ? '' : ' '
    rows[0] += gap + glyph[0]
    rows[1] += gap + glyph[1]
    rows[2] += gap + glyph[2]
  })

  return rows
}

export function fit(text: string, width: number): string {
  if (width <= 0) return ''
  const flat = text.replace(/\s+/g, ' ').trim()

  return flat.length <= width ? flat : `${flat.slice(0, Math.max(0, width - 1))}…`
}

export function ago(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`

  return `${Math.floor(hours / 24)}d`
}

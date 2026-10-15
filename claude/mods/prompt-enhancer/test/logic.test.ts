import { expect, test } from 'claude-code/testing'

import { askBody, buildSystem, cleanReply, cleanRules, countWords, parseMinWords, shouldOffer } from '../hooks/logic'

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ')

test('24 words pass through, 25 are offered', () => {
  expect(shouldOffer(words(24), true, 25)).toBe(false)
  expect(shouldOffer(words(25), true, 25)).toBe(true)
})

test('minWords option moves the line', () => {
  expect(shouldOffer(words(10), true, parseMinWords(10))).toBe(true)
  expect(shouldOffer(words(9), true, parseMinWords(10))).toBe(false)
})

test('a bad minWords falls back to 25, 0 included', () => {
  for (const bad of [0, -3, Number.NaN, 'ten', null, undefined]) expect(parseMinWords(bad)).toBe(25)
  expect(parseMinWords(12.7)).toBe(12)
})

test('off never offers', () => {
  expect(shouldOffer(words(60), false, 25)).toBe(false)
})

test('a leading slash or bang skips, also after whitespace', () => {
  expect(shouldOffer(`/review ${words(40)}`, true, 25)).toBe(false)
  expect(shouldOffer(`  /review ${words(40)}`, true, 25)).toBe(false)
  expect(shouldOffer(`!ls ${words(40)}`, true, 25)).toBe(false)
  expect(shouldOffer(`see a/b ${words(40)}`, true, 25)).toBe(true)
})

test('image tokens do not count as words', () => {
  expect(countWords(`${words(24)} [Image #1] [Image #2]`)).toBe(24)
  expect(shouldOffer(`${words(24)} [Image #1]`, true, 25)).toBe(false)
})

test('code blocks count as words and blank text counts zero', () => {
  expect(countWords('a\n```\nb c\n```\nd')).toBe(6)
  expect(countWords('   ')).toBe(0)
})

test('the template has all six sections and the placeholder rule', () => {
  const s = buildSystem('')
  for (const part of ['Goal', 'Context', 'Constraints', 'Acceptance criteria', 'Out of scope', 'Output format']) expect(s).toContain(part)
  expect(s).toContain('[?: what is needed]')
  expect(s).toContain('language')
  expect(s).toContain('<prompt>')
  expect(s).toContain('[Image #N]')
  expect(s).toContain('Leave out a section that has nothing real to say')
})

test('empty rules add no rules block, set rules are appended verbatim', () => {
  expect(buildSystem('')).not.toContain('Apply these rules')
  const s = buildSystem('rule A: prefer small diffs\nrule B: ask first')
  expect(s).toContain('Apply these rules')
  expect(s).toContain('rule A: prefer small diffs\nrule B: ask first')
})

test('a non-string rules option is ignored and a long one is capped', () => {
  expect(cleanRules(42)).toBe('')
  expect(cleanRules(undefined)).toBe('')
  expect(cleanRules('x'.repeat(5000)).length).toBe(2000)
})

test('the default template names no project or tool', () => {
  const s = buildSystem('').toLowerCase()
  for (const word of ['azure', 'nx ', 'vitest', 'dotnet', 'pnpm']) expect(s).not.toContain(word)
})

test('cleanReply trims, strips one wrapping fence and drops empty text', () => {
  expect(cleanReply('  hi  ')).toBe('hi')
  expect(cleanReply('```\nGoal: x\n```')).toBe('Goal: x')
  expect(cleanReply('   ')).toBeUndefined()
})

test('a long improved text is shortened in the dialog body only', () => {
  const body = askBody('y'.repeat(3000))
  expect(body).toContain('(shortened)')
  expect(body.length).toBeLessThan(2100)
  expect(askBody('short')).toBe('short\n\nSend which?')
})

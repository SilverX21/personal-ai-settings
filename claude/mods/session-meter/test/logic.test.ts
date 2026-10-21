import { describe, expect, test } from 'claude-code/testing'

import { DEFAULT_THRESHOLDS, bar, cacheState, contextTone, minutesLeft, prettyModel, thresholds, ttlFromUsage } from '../hooks/logic'

const MIN = 60_000

describe('cacheState', () => {
  test('60-minute TTL uses 12-minute bands', () => {
    expect([60, 49, 48, 37, 36, 25, 24, 13, 12, 1].map(m => cacheState(m * MIN, 60))).toEqual([
      'Warm', 'Warm', 'Lukewarm', 'Lukewarm', 'Mild', 'Mild', 'Cool', 'Cool', 'Chilly', 'Chilly',
    ])
    expect(cacheState(0, 60)).toBe('Cold')
    expect(cacheState(-5 * MIN, 60)).toBe('Cold')
  })

  test('5-minute TTL scales to 1-minute bands', () => {
    expect([5, 4, 3, 2, 1].map(m => cacheState(m * MIN, 5))).toEqual(['Warm', 'Lukewarm', 'Mild', 'Cool', 'Chilly'])
    expect(cacheState(0, 5)).toBe('Cold')
  })
})

test('prettyModel', () => {
  expect(prettyModel('claude-opus-5-5')).toBe('Opus 5.5')
  expect(prettyModel('claude-sonnet-5')).toBe('Sonnet 5')
  expect(prettyModel('claude-haiku-4-5-20251001')).toBe('Haiku 4.5')
  expect(prettyModel('claude-opus-5-5[1m]')).toBe('Opus 5.5')
  expect(prettyModel('gpt-x')).toBe('gpt-x')
})

test('ttlFromUsage reads the newest write bucket', () => {
  expect(ttlFromUsage('"ephemeral_5m_input_tokens":0\n"ephemeral_1h_input_tokens":1264')).toBe(60)
  expect(ttlFromUsage('"ephemeral_1h_input_tokens":0\n"ephemeral_5m_input_tokens":900')).toBe(5)
  expect(ttlFromUsage('"ephemeral_5m_input_tokens":0\n"ephemeral_1h_input_tokens":0')).toBeNull()
  expect(ttlFromUsage('')).toBeNull()
})

test('bar and minutesLeft', () => {
  expect(bar(38)).toBe('▓▓▓▓░░░░░░')
  expect(bar(150)).toBe('▓▓▓▓▓▓▓▓▓▓')
  expect(minutesLeft(31.5 * MIN)).toBe('31m')
  expect(minutesLeft(30_000)).toBe('<1m')
  expect(minutesLeft(0)).toBe('expired')
})

describe('thresholds', () => {
  test('no options gives the defaults', () => {
    expect(thresholds({})).toEqual(DEFAULT_THRESHOLDS)
  })

  test('good values are used, bad ones fall back one by one', () => {
    expect(thresholds({ yellowPercent: 20, warnPercent: 'abc', redPercent: 150, coldTipPercent: -1 })).toEqual({
      ...DEFAULT_THRESHOLDS,
      yellow: 20,
    })
    expect(thresholds({ warnPercent: '' }).warn).toBe(DEFAULT_THRESHOLDS.warn)
    expect(thresholds({ yellowPercent: 0, warnPercent: 0 }).warn).toBe(0)
  })

  test('out-of-order yellow/warn/red fall back to the defaults, coldTip is kept', () => {
    const d = DEFAULT_THRESHOLDS
    expect(thresholds({ warnPercent: 20 })).toEqual(d)
    expect(thresholds({ yellowPercent: 50, warnPercent: 40, redPercent: 70, coldTipPercent: 10 })).toEqual({ ...d, coldTip: 10 })
    expect(thresholds({ redPercent: 40 })).toEqual(d)
    expect(thresholds({ yellowPercent: 40, warnPercent: 40, redPercent: 40 })).toMatchObject({ yellow: 40, warn: 40, red: 40 })
  })

  test('contextTone follows the thresholds', () => {
    const t = { yellow: 10, warn: 20, red: 30, coldTip: 5 }
    expect([5, 10, 20, 29, 30].map(p => contextTone(p, t))).toEqual([undefined, 'warning', 'warning', 'warning', 'error'])
  })
})

// Pure display and parsing helpers: no engine calls, so tests run them directly.

export type CacheState = 'Warm' | 'Lukewarm' | 'Mild' | 'Cool' | 'Chilly' | 'Cold'
export type Tone = 'success' | 'warning' | 'error' | undefined

const STATES: readonly CacheState[] = ['Warm', 'Lukewarm', 'Mild', 'Cool', 'Chilly']

/** 'claude-opus-5-5' -> 'Opus 5.5', 'claude-haiku-4-5-20251001' -> 'Haiku 4.5'; anything else as given. */
export function prettyModel(id: string): string {
  const m = /claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?!\d)/.exec(id.replace(/\[.*\]$/, ''))
  if (!m) return id
  const name = m[1]!.charAt(0).toUpperCase() + m[1]!.slice(1)
  return `${name} ${m[2]}${m[3] ? `.${m[3]}` : ''}`
}

/** Five equal bands over the TTL, then Cold (D6): 60 min -> 12-min bands, 5 min -> 1-min bands. */
export function cacheState(remainingMs: number, ttlMin: number): CacheState {
  if (remainingMs <= 0) return 'Cold'
  const band = (ttlMin * 60_000) / STATES.length
  const index = STATES.length - Math.ceil(remainingMs / band)
  return STATES[Math.min(Math.max(index, 0), STATES.length - 1)]!
}

export function cacheTone(state: CacheState): Tone {
  if (state === 'Warm' || state === 'Lukewarm') return 'success'
  if (state === 'Mild' || state === 'Cool') return 'warning'
  return 'error'
}

export function contextTone(percent: number, warnPercent: number): Tone {
  if (percent >= 60) return 'error'
  if (percent >= 30 || percent >= warnPercent) return 'warning'
  return undefined
}

export function bar(percent: number, width = 10): string {
  const filled = Math.min(width, Math.max(0, Math.round((percent / 100) * width)))
  return '▓'.repeat(filled) + '░'.repeat(width - filled)
}

export function minutesLeft(remainingMs: number): string {
  if (remainingMs <= 0) return 'expired'
  const min = Math.floor(remainingMs / 60_000)
  return min < 1 ? '<1m' : `${min}m`
}

/**
 * Reads the TTL bucket of the newest cache write from transcript lines (D24).
 * Input: `"ephemeral_5m_input_tokens":N` / `"ephemeral_1h_input_tokens":N` matches, oldest first.
 * Returns 60 or 5, or null when the newest response wrote nothing to the cache.
 */
export function ttlFromUsage(matches: string): 60 | 5 | null {
  const pairs = [...matches.matchAll(/"ephemeral_(5m|1h)_input_tokens":(\d+)/g)]
  const last = pairs.slice(-2)
  const oneHour = last.find(p => p[1] === '1h')
  const fiveMin = last.find(p => p[1] === '5m')
  if (oneHour && Number(oneHour[2]) > 0) return 60
  if (fiveMin && Number(fiveMin[2]) > 0) return 5
  return null
}

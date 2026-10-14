export type Meter = {
  sessionId: string
  model: string
  percent: number | null
  tokens: number | null
  /** Time of the last main-thread response, which refreshes the prompt cache. */
  lastTouch: number | null
  now: number
  ttlMin: number
  ttlSource: 'default' | 'detected' | 'manual'
  overageLikely: boolean
  warned: boolean
  handoff: 'idle' | 'running' | 'ready'
  handoffPath: string
}

export type PendingHandoff = {
  text: string
  at: number
  fromSession: string
  isUsed: boolean
  // Set by session.end with reason 'clear': only a /clear may refill, not a resume or a fresh start.
  isCleared?: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'session-meter': { meter: Meter }
  }
}

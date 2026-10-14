export type Mode = 'observe' | 'off'

export type LogEntry = {
  at: number
  cwd: string
  kind: 'suite' | 'push'
  segment: string
  reason: string
}

declare module 'claude-code' {
  interface PluginState {
    'test-guard': { mode: Mode }
  }
}

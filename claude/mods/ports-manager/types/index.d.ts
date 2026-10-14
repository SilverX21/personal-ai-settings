export type Listener = { command: string; pid: number; user: string; port: number }

// A listener as the pane shows it.
export type PortRow = Listener & { label: string; project: string; up: string }

declare module 'claude-code' {
  interface PluginState {
    'ports-manager': {
      rows: PortRow[]
      isOpen: boolean
      showAll: boolean
      error: string | null
    }
  }
}

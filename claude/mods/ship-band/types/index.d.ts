export type View = {
  key: string
  branch: string
  source: 'azure' | 'github' | 'none'
  steps: Partial<Record<string, 'done' | 'stale'>>
}

export type Where = { key: string; branch: string; root: string }

declare module 'claude-code' {
  interface PluginState {
    'ship-band': {
      view: View | null
      isHidden: boolean
      // Skills started this turn, with whether an edit came after: they count as done when the turn ends.
      pending: Record<string, boolean>
      where: Where | null
      // One question per session: a dismissed one is not repeated; `/ship-band source` asks again.
      isAsked: boolean
    }
  }
}

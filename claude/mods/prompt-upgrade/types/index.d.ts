export type Step = 'compose' | 'reading' | 'questions' | 'rewriting' | 'review' | 'error'

export type Question = { q: string; options: string[] }

export type Answer = { choice: string } | { skipped: true }

export type Flow = {
  id: string
  original: string
  step: Step
  questions: Question[]
  answers: Record<string, Answer>
  otherOpen: number | null
  upgraded: string
  added: string[]
  isEditing: boolean
  failedStep: 'reading' | 'rewriting' | null
  errorText: string
  isCopied: boolean
  callId: string
}

export type HistoryEntry = {
  id: string
  at: number
  original: string
  upgraded: string
  added: string[]
  questions: Question[]
  answers: Record<string, Answer>
}

export type View = 'flow' | 'history'

declare module 'claude-code' {
  interface PluginState {
    'prompt-upgrade': {
      flow: Flow | null
      history: HistoryEntry[]
      auto: boolean
      view: View
    }
  }
}

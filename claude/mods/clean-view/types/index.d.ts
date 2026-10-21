export type CleanViewPhase = 'working' | 'needs-you' | 'stuck' | 'stopped' | 'done'

export type CleanViewTaskStatus = 'done' | 'active' | 'upcoming'

export type CleanViewTask = {
  id: string
  name: string
  status: CleanViewTaskStatus
  percent: number
  hasReported: boolean
}

export type CleanViewChecklist = {
  title: string
  phase: CleanViewPhase
  tasks: CleanViewTask[]
  /** False while only the placeholder steps show; true once Claude has planned. */
  hasPlan: boolean
  needsYouReason: string | null
  stuckReason: string | null
  startedAt: number
  finishedAt: number | null
  isCollapsed: boolean
}

export type DockHelperStatus = 'queued' | 'working' | 'done' | 'stuck'

export type DockHelperModel = 'fast' | 'same'

export type DockHelper = {
  /** The Agent call's tool_use_id. */
  id: string
  name: string
  status: DockHelperStatus
  percent: number
  hasReported: boolean
  /** Which mascot and color the card wears. */
  face: number
  startedAt: number | null
  finishedAt: number | null
  /** The helper's own loop id, once it has started; its reports carry it. */
  agentId: string | null
}

export type DockMission = {
  job: string
  /** The Team Size this request was sent with. */
  size: number
  startedAt: number
  finishedAt: number | null
  helpers: DockHelper[]
  /** Agent calls let through for this request. */
  launched: number
  isNudged: boolean
}

export type DockCounts = { working: number; queued: number; done: number; stuck: number }

export type DockSettings = {
  size: number
  helperModel: DockHelperModel
  /** A big team waiting for Continue or Cancel. */
  pendingSize: number | null
  isCustomOpen: boolean
  isFolded: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'clean-view': {
      cleanViewEnabled: boolean
      checklist: CleanViewChecklist | null
      tick: number
      dockSettings: DockSettings
      dockMission: DockMission | null
      dockTick: number
    }
  }
}

// Agent Dock: everything that needs no `$`, so tests can call it directly.
import type { DockCounts, DockHelper, DockHelperModel, DockMission } from '../types'

export const MIN_SIZE = 1
export const MAX_SIZE = 100
/** Above this a size asks first and never carries over to the next session. */
export const BIG_TEAM = 20
export const SIZES = [1, 3, 5, 10, 20, 50, 100] as const
/** More helpers than this draw as small tiles instead of full cards. */
export const TILE_FROM = 13
export const FACE_COUNT = 36
export const DEFAULT_MAX_SUBAGENTS = 20
export const DEFAULT_MAX_TOOL_USE = 10

const JOB_MAX = 40
const TASK_MAX = 30

export const CORAL = '#E8735A'
export const GOLD = '#E6B45A'
export const GREEN = '#5FB98A'
export const RED = '#D9534F'
export const HAIRLINE = '#3A3A40'

/** One calm color per face; the PNG mascots use the same order. */
export const FACE_COLORS = [
  '#E8735A', '#E6B45A', '#5FB98A', '#4FA3A5', '#6C8EBF', '#9C88C9',
  '#D9798F', '#C9A97C', '#8FAE7E', '#6FB3D6', '#C27B4E', '#A0729C',
] as const

export const SIZE_HINT = 'Team Size is a whole number from 1 to 100, e.g. /dock 10.'
export const BAD_NUMBER = 'Type a whole number from 1 to 100'
export const TOO_NARROW = 'The window is too narrow to show the Agent Dock. Widen it or watch the status bar.'
export const STOPPED = 'Stopped before this helper started.'
export const HELPER_PLAN = 'Helpers skip the plan. Just call report_progress as you work.'

// ── Sizes ──────────────────────────────────────────────────────────────────

/** A whole number from 1 to 100, or null. */
export function parseSize(raw: unknown): number | null {
  const text = String(raw ?? '').trim()
  if (!/^\d+$/.test(text)) {
    return null
  }
  const size = Number(text)

  return size >= MIN_SIZE && size <= MAX_SIZE ? size : null
}

/** What a saved size comes back as in a new session: a big team resets to 1. */
export function restoreSize(saved: unknown): number {
  const size = parseSize(saved)

  return size === null || size > BIG_TEAM ? MIN_SIZE : size
}

export const isBigTeam = (size: number) => size > BIG_TEAM

/** Helpers that run at once: the lower of the engine's two limits. */
export function atOnce(maxSubagents: string | undefined, maxToolUse: string | undefined): number {
  const read = (raw: string | undefined, fallback: number) => {
    const n = Number(raw)

    return Number.isInteger(n) && n > 0 ? n : fallback
  }

  return Math.min(read(maxSubagents, DEFAULT_MAX_SUBAGENTS), read(maxToolUse, DEFAULT_MAX_TOOL_USE))
}

export const modelLabel = (model: DockHelperModel) => (model === 'fast' ? 'Fast & Cheap' : 'Same model as you')

export function infoLine(size: number, concurrency: number, model: DockHelperModel): string {
  const split = size === 1 ? 'Claude decides how many helpers' : `Splits each request across ${size} helpers`

  return `${split}  ·  ${Math.min(size, concurrency)} at a time  ·  ${modelLabel(model)}`
}

// ── Names ──────────────────────────────────────────────────────────────────

function cut(text: string, max: number): string {
  if (text.length <= max) {
    return text
  }
  let short = text.slice(0, max - 1)
  const space = short.lastIndexOf(' ')
  if (space > max / 3) {
    short = short.slice(0, space)
  }

  return short.replace(/[\s,;:.\-–—]+$/, '') + '…'
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** The job's name: the first clause of the request, about 40 characters. */
export function jobName(prompt: string): string {
  const line = prompt.trim().split('\n').find(one => one.trim() !== '') ?? ''
  const clause = line
    .split(/[.!?;:]\s|[.!?;]$|,\s|\s[-–—]\s/)[0]!
    .replace(/^(please|hey|hi|ok|okay)\b[,\s]*/i, '')
    .replace(/^(can|could|would|will) you\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  return clause === '' ? 'Your request' : cut(capitalize(clause), JOB_MAX)
}

/** A helper's task name: its description, 3 to 5 plain words. */
export function taskName(description: unknown): string {
  const words = String(description ?? '')
    .replace(/[`*_#"]/g, '')
    .split(/\s+/)
    .filter(word => word !== '')
    .slice(0, 5)

  return words.length === 0 ? 'Helper' : cut(capitalize(words.join(' ')), TASK_MAX)
}

/** Two letters for a face: the first and last word's first letters. */
export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(word => word !== '')
  const first = words[0] ?? 'Agent'
  const last = words.length > 1 ? words[words.length - 1]! : first.slice(1)

  return (first.charAt(0) + (last.charAt(0) || first.charAt(1) || 'G')).toUpperCase()
}

export const faceColor = (face: number) => FACE_COLORS[face % FACE_COLORS.length]!
export const faceFile = (face: number) => `helper-${String((face % FACE_COUNT) + 1).padStart(2, '0')}.png`

// ── What the model reads ─────────────────────────────────────────────────

export function splitInstruction(size: number): string {
  return [
    `# Agent Dock: Team Size is ${size}`,
    `- Split this request into exactly ${size} independent pieces and launch one helper (the Agent tool) per piece, all in one message so they run in parallel.`,
    '- Find a real split, one helper per item (per store, per task, per file, per section). Never argue that it cannot be split and never pad with useless work.',
    '- Give each helper a short plain-English description of 3 to 5 words, e.g. "Price check: Panera".',
    '- In each helper\'s prompt add: "As you work, call report_progress with your task name and a percent at about 25, 50, 75 and 100. Do not call plan_steps."',
    '- When they finish, combine their results into one answer.',
  ].join('\n')
}

export const capDenial = (size: number) =>
  `Team Size is ${size}: this request already has ${size} helpers. Finish with the helpers you have.`

export const nudgeText = (used: number, size: number) =>
  `You used ${used} of ${size} helpers. Split the remaining work across the other ${size - used}, one helper per piece, all in parallel.`

/** Whether a finished turn earns its one follow-up. */
export const needsNudge = (mission: DockMission, size: number) =>
  size > 1 && !mission.isNudged && mission.launched < size

// ── The mission ────────────────────────────────────────────────────────────

export function newMission(job: string, size: number, startedAt: number): DockMission {
  return { job, size, startedAt, finishedAt: null, helpers: [], launched: 0, isNudged: false }
}

function newHelper(id: string, description: unknown, face: number): DockHelper {
  return {
    id,
    name: taskName(description),
    status: 'queued',
    percent: 0,
    hasReported: false,
    face,
    startedAt: null,
    finishedAt: null,
    agentId: null,
  }
}

/** Queued cards for Agent calls the model has written, each once. */
export function queueHelpers(
  mission: DockMission,
  calls: ReadonlyArray<{ id: string; description: unknown }>,
): DockMission {
  const helpers = [...mission.helpers]
  for (const call of calls) {
    if (!helpers.some(helper => helper.id === call.id)) {
      helpers.push(newHelper(call.id, call.description, helpers.length))
    }
  }

  return { ...mission, helpers, finishedAt: null }
}

function patch(mission: DockMission, id: string, fn: (helper: DockHelper) => DockHelper): DockMission {
  return { ...mission, helpers: mission.helpers.map(helper => (helper.id === id ? fn(helper) : helper)) }
}

export const startHelper = (mission: DockMission, id: string, now: number) =>
  patch(mission, id, helper => ({ ...helper, status: 'working', startedAt: now }))

export const linkAgent = (mission: DockMission, id: string, agentId: string) =>
  patch(mission, id, helper => ({ ...helper, agentId }))

export const finishHelper = (mission: DockMission, id: string, isStuck: boolean, now: number) =>
  patch(mission, id, helper => ({
    ...helper,
    status: isStuck ? 'stuck' : 'done',
    percent: isStuck ? helper.percent : 100,
    hasReported: true,
    finishedAt: now,
    startedAt: helper.startedAt ?? now,
  }))

/** A helper's own report moves its meter; a finished card stays put. */
export function reportProgress(mission: DockMission, agentId: string, percent: number): DockMission {
  return {
    ...mission,
    helpers: mission.helpers.map(helper =>
      helper.agentId === agentId && helper.status === 'working'
        ? { ...helper, percent: clampPercent(percent), hasReported: true }
        : helper,
    ),
  }
}

export function clampPercent(raw: unknown): number {
  const n = Number(raw)

  return Math.round(Math.min(100, Math.max(0, Number.isFinite(n) ? n : 0)))
}

export function counts(helpers: readonly DockHelper[]): DockCounts {
  const count = (status: DockHelper['status']) => helpers.filter(helper => helper.status === status).length

  return { working: count('working'), queued: count('queued'), done: count('done'), stuck: count('stuck') }
}

export const isLive = (mission: DockMission | null) =>
  mission !== null && mission.helpers.some(helper => helper.status === 'queued' || helper.status === 'working')

export const isComplete = (mission: DockMission | null) =>
  mission !== null && mission.finishedAt !== null && mission.helpers.length > 0

/** Overall percent: each helper's share, out of the team size or the cards drawn. */
export function missionPercent(mission: DockMission): number {
  if (isComplete(mission)) {
    return 100
  }
  const total = Math.max(mission.size, mission.helpers.length, 1)
  const sum = mission.helpers.reduce(
    (acc, helper) => acc + (helper.status === 'done' || helper.status === 'stuck' ? 100 : helper.percent),
    0,
  )

  return Math.round(sum / total)
}

/** The mission bar's three runs of cells: done, working, the rest. */
export function missionSegments(mission: DockMission, width: number) {
  const total = Math.max(mission.size, mission.helpers.length, 1)
  const c = counts(mission.helpers)
  const done = isComplete(mission) ? width : Math.round(((c.done + c.stuck) / total) * width)
  const working = Math.min(width - done, Math.round((c.working / total) * width))

  return { done, working, rest: Math.max(0, width - done - working) }
}

// ── Words on screen ───────────────────────────────────────────────────────

export function badge(c: DockCounts): string {
  const parts = [`${c.working} working`, `${c.queued} queued`, `${c.done} done`]
  if (c.stuck > 0) {
    parts.push(`${c.stuck} stuck`)
  }

  return parts.join(' · ')
}

/** A timer: 0:41, 12:05. */
export function clock(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** A length of time in words: 45s, 2m 14s. */
export function duration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(seconds / 60)

  return minutes === 0 ? `${seconds}s` : `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`
}

export function summary(mission: DockMission): string {
  const n = mission.helpers.length
  const took = duration((mission.finishedAt ?? mission.startedAt) - mission.startedAt)
  const { stuck } = counts(mission.helpers)
  const line = `${n} ${n === 1 ? 'agent' : 'agents'} finished ${mission.job} in ${took}`

  return stuck > 0 ? `${line} (${stuck} got stuck)` : line
}

/** A card's meter cells: filled and empty, or a sweep while it has not reported. */
export function meter(helper: DockHelper, width: number, tick: number): { filled: number; sweepAt: number | null } {
  if (helper.status === 'done') {
    return { filled: width, sweepAt: null }
  }
  if (helper.status === 'working' && !helper.hasReported) {
    return { filled: 0, sweepAt: (tick % (width + 4)) - 2 }
  }

  return { filled: Math.round((helper.percent / 100) * width), sweepAt: null }
}

/** Cards per row by the pane's width. */
export function cardsPerRow(columns: number): number {
  return columns >= 100 ? 3 : columns >= 62 ? 2 : 1
}

export const TILE_WIDTH = 11
export const tilesPerRow = (columns: number) => Math.max(1, Math.floor(columns / TILE_WIDTH))

/** Wider-spaced letters for headings: "AGENT" -> "A G E N T". */
export const spaced = (text: string) => text.split('').join(' ')

/** A color part way from one hex to another. */
export function blend(from: string, to: string, t: number): string {
  const a = from.match(/[0-9a-f]{2}/gi)!.map(part => parseInt(part, 16))
  const b = to.match(/[0-9a-f]{2}/gi)!.map(part => parseInt(part, 16))
  const mixed = a.map((value, i) => Math.round(value + (b[i]! - value) * Math.min(1, Math.max(0, t))))

  return '#' + mixed.map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase()
}

/** Which idle seats glow: a slow pattern that shifts with each step. */
export const seatGlows = (seat: number, step: number) => (seat * 7 + step) % 9 === 0

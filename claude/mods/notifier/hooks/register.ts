import type { EngineInterface, Register } from 'claude-code'

import type { TaskNote, TestCounts } from './logic'
import { MAX_OUTPUT_BYTES, doneText, isTaskOutputPath, minMs, parseTaskNote, parseTestCounts, taskText } from './logic'

export const register: Register = (on, options) => {
  const minTurnMs = minMs(options.minSeconds)

  // Subagents also raise turn.complete (with an agentId); their end is announced by the task notification instead, so only the main loop's turns count here.
  on('turn.complete', async ($, e, next) => {
    if (e.reason === 'answer' && !e.agentId && e.durationMs >= minTurnMs) void send($, doneText(e.answer))
    return next(e)
  }).catch(($, e, next) => next(e))

  // A background agent or shell finished: the engine hands its notification to the next prompt with this origin.
  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind === 'task-notification') void notifyTask($, e.text)
    return next(e)
  }).catch(($, e, next) => next(e))
}

// Never rejects: it runs unawaited, and a notification is a courtesy that must not surface as an error in the person's session.
async function notifyTask($: EngineInterface, text: string) {
  try {
    const note = parseTaskNote(text)
    const counts = await countsFor($, note).catch(() => undefined)
    await send($, taskText(note, counts))
  } catch {
    // Nothing to report: the worst case is a missing banner.
  }
}

// Test counts come only from a completed shell task's own output file. An agent's file is a transcript, not a test log, and an unknown task is treated like one.
async function countsFor($: EngineInterface, note: TaskNote): Promise<TestCounts | undefined> {
  if (note.status !== 'completed' || !note.id || !note.outputFile) return undefined
  const agents = await $.agent.list().catch(() => undefined)
  if (!agents || agents.some(a => a.id === note.id)) return undefined
  if (!(await isOwnOutputFile($, note.outputFile, note.id))) return undefined
  return parseTestCounts(await $.fs.read(note.outputFile))
}

// A plain file, not a link, whose real path is the path it was named by (so no link in any folder above it), of a sane size, in a tasks folder and named for this task.
async function isOwnOutputFile($: EngineInterface, path: string, taskId: string): Promise<boolean> {
  if (!isTaskOutputPath(path, taskId)) return false
  const st = await $.fs.stat(path, { resolve: true }).catch(() => undefined)
  return st !== undefined && st.kind === 'file' && !st.isLink && st.realPath === path && st.size <= MAX_OUTPUT_BYTES
}

// Respects the person's notification settings: notify itself decides whether a banner shows (turned off, no channel), and a refusal is not an error here.
async function send($: EngineInterface, text: string) {
  try {
    await $.ui.notify(text)
  } catch {
    // A refused or failed banner is not worth an error.
  }
}

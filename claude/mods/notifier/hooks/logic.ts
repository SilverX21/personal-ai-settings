const MAX_BANNER_CHARS = 160
const TAIL_CHARS = 200_000
const DEFAULT_MIN_SECONDS = 120 // the same default plugin.json shows in the config menu
export const MAX_OUTPUT_BYTES = 5_000_000

const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?|\x1b./g
const CONTROL = /[\x00-\x1f\x7f-\x9f]+/g

// Text from a model or a command ends up in an OS banner (and maybe on a lock screen): no escape sequences, no line breaks, a bounded length.
export function banner(text: string): string {
  const one = text.replace(ANSI, '').replace(CONTROL, ' ').replace(/\s+/g, ' ').trim()
  return one.length > MAX_BANNER_CHARS ? `${one.slice(0, MAX_BANNER_CHARS - 1)}…` : one
}

// "Done: " plus the first non-empty line of the answer, so the banner says what finished.
export function doneText(answer: string): string {
  const first = answer.split('\n').map(l => l.trim()).find(Boolean)
  return first ? banner(`Done: ${first}`) : 'Done'
}

// A bad or missing setting falls back to the default: a NaN would make every turn count as too short, silently.
export function minMs(minSeconds: unknown): number {
  const n = Number(minSeconds)
  return (Number.isFinite(n) && n >= 0 ? n : DEFAULT_MIN_SECONDS) * 1000
}

export type TaskNote = { id?: string; status?: string; summary?: string; outputFile?: string }

// The engine words a background task's notification as <task-id>, <tool-use-id>, <output-file>, <status> and <summary> tags, in that order, then may add the agent's report.
// The first match of each tag wins, so a tag that a summary or a report happens to contain comes later and is ignored.
export function parseTaskNote(text: string): TaskNote {
  const tag = (name: string) => new RegExp(`<${name}>\\s*([\\s\\S]*?)\\s*</${name}>`).exec(text)?.[1]
  return { id: tag('task-id'), status: tag('status'), summary: tag('summary'), outputFile: tag('output-file') }
}

// A task's output file is `<some folder>/tasks/<task id>.output`, named for the very task the notification is about. The folder above `tasks` is not the session id (a cleared session keeps the folder of the one before it), so it is not checked.
// Shape half of the guard: absolute, no empty, . or .. segments. The notifier also checks with fs.stat that it is a plain file whose real path is this very path.
export function isTaskOutputPath(path: string, taskId: string): boolean {
  if (!path.startsWith('/') || !/^[\w-]+$/.test(taskId)) return false
  const parts = path.slice(1).split('/')
  if (parts.length < 3 || parts.some(p => p === '' || p === '.' || p === '..')) return false
  const [dir, file] = parts.slice(-2)
  return dir === 'tasks' && file === `${taskId}.output`
}

export type TestCounts = { passed: number; failed: number }

const num = (s: string | undefined) => (s === undefined ? 0 : Number(s))

// Every summary in the output is added up, so a run of several projects counts them all.
// Vitest: `Tests  3 failed | 42 passed (45)`. Jest: `Tests:       3 failed, 42 passed, 45 total`.
// dotnet test: `Passed!  - Failed:     0, Passed:    42, Skipped:     0, Total:    42`, once per test project.
export function parseTestCounts(output: string): TestCounts | undefined {
  const tail = output.slice(-TAIL_CHARS).replace(ANSI, '')
  let found = false
  const sum: TestCounts = { passed: 0, failed: 0 }
  for (const m of tail.matchAll(/^[ \t]*Tests:?[ \t]+(.*)$/gm)) {
    const line = m[1]!
    if (!/\bpassed\b|\bfailed\b/.test(line)) continue
    found = true
    sum.passed += num(/(\d+) passed/.exec(line)?.[1])
    sum.failed += num(/(\d+) failed/.exec(line)?.[1])
  }
  for (const m of tail.matchAll(/^(?:Passed|Failed)!\s+- Failed:\s*(\d+), Passed:\s*(\d+)/gm)) {
    found = true
    sum.failed += num(m[1])
    sum.passed += num(m[2])
  }
  return found ? sum : undefined
}

export const testsText = (c: TestCounts): string => `Tests: ${c.passed} passed, ${c.failed} failed`

// What a finished background task says: test counts when its output has them, else the engine's own one-line summary.
export function taskText(note: TaskNote, counts: TestCounts | undefined): string {
  if (counts) return testsText(counts)
  return banner(note.summary || `Background task ${note.status ?? 'finished'}`) || 'Background task finished'
}

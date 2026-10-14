import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { LogEntry, Mode } from '../types'
import { classify } from './logic'

const mode = atom({ plugin: 'test-guard', key: 'mode' } as const, 'observe')
const LOG_KEY = 'log'
const LOG_CAP = 500
const MODES: readonly Mode[] = ['observe', 'off']

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'test-guard',
      description: 'Full-suite test guard: observe | off | log',
      argumentHint: 'observe | off | log',
    })
    return next(e)
  })

  on('command.run', { command: 'test-guard' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'log' || arg === '') {
      const log = ((await $.store.get(LOG_KEY)) as LogEntry[] | undefined) ?? []
      const current = await read($, mode)
      if (log.length === 0) return { text: `${current}. Nothing caught yet.` }
      const lines = log.slice(-30).map(l => `${localTime(l.at)} ${l.kind.padEnd(5)} ${l.segment.slice(0, 90)}\n    ${l.reason}`)
      return { text: `${current}. Last ${lines.length} of ${log.length} catches:\n${lines.join('\n')}` }
    }
    if (!MODES.includes(arg as Mode)) return { text: `Unknown option "${arg}". Use: observe | off | log` }
    await update($, mode, () => arg as Mode)
    return { text: `test-guard is now ${arg} for this session.` }
  })

  // Observe mode never changes or blocks the call: it only records what ask mode would have caught.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if ((await read($, mode)) === 'off') return next(e)
    const hit = classify(e.command)
    if (!hit) return next(e)
    if (hit.kind === 'push' && !(await prePushRunsTests($))) return next(e)

    const entry: LogEntry = { at: await $.clock.now(), cwd: await $.session.cwd(), ...hit }
    const log = ((await $.store.get(LOG_KEY)) as LogEntry[] | undefined) ?? []
    await $.store.set(LOG_KEY, [...log, entry].slice(-LOG_CAP))
    $.ui.log(`test-guard (observe): would ask about \`${hit.segment.slice(0, 100)}\`: ${hit.reason}`)
    return next(e)
  }).catch(($, e, next) => next(e))
}

async function prePushRunsTests($: EngineInterface): Promise<boolean> {
  const root = (await $.session.repo())?.root
  if (!root) return false
  const hook = `${root}/.husky/pre-push`
  if (!(await $.fs.exists(hook))) return false
  return /\btest\b/.test(await $.fs.read(hook))
}

// Local "YYYY-MM-DD HH:MM" (toISOString would print UTC).
function localTime(at: number): string {
  const d = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

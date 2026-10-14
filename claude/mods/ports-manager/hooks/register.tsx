import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { PortRow } from '../types'
import { PS_SELF, ancestorPids, formatUp, isProtected, label, parseCwds, parseEtimes, parseLsof, projectName, sameTarget, visible } from './logic'
import type { Snapshot, Target } from './logic'

const PANE = 'ports-manager'
const REFRESH_MS = 5_000
const GRACE_MS = 3_000
const RUN_MS = 5_000
const SIGNAL_MS = 3_000

const rows = atom({ plugin: 'ports-manager', key: 'rows' } as const, [])
const isOpen = atom({ plugin: 'ports-manager', key: 'isOpen' } as const, false)
const showAll = atom({ plugin: 'ports-manager', key: 'showAll' } as const, false)
const error = atom({ plugin: 'ports-manager', key: 'error' } as const, null)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'ports-manager', description: 'See and stop leftover dev servers' })
    // One cheap tick for the whole session: it does nothing while the pane is closed, so there is no timer to cancel.
    $.clock.every(REFRESH_MS, async () => {
      if (await read($, isOpen)) await refresh($)
    })
    return next(e)
  })

  on('command.run', { command: 'ports-manager' }, async $ => {
    await update($, isOpen, () => true)
    await $.ui.open({ id: PANE, title: 'Ports' })
    await refresh($)
    return { text: 'Ports pane opened.' }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) await update($, isOpen, () => false)
    return next(e)
 }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const list = await read($, rows)
    const problem = await read($, error)
    const isAll = await read($, showAll)

    return (
      <Box flexDirection="column">
        <Text dimColor>{line(['Port', 'Label', 'Process', 'PID', 'Project', 'Up'])}</Text>
        {problem && <Text>{problem}</Text>}
        {!problem && list.length === 0 && <Text dimColor>No {isAll ? '' : 'dev '}servers are listening.</Text>}
        {list.map(r => (
          <Box key={`${r.pid}-${r.port}`}>
            <Text>{line([String(r.port), r.label, r.command, String(r.pid), r.project, r.up])} </Text>
            <Button key={`kill-${r.pid}-${r.port}`} label="Kill" onPress={() => stopOne($, r)} />
          </Box>
        ))}
        <Box>
          <Button key="refresh" label="Refresh" onPress={() => refresh($)} />
          <Button key="all" label={isAll ? 'Dev only' : 'Show all'} onPress={() => toggleAll($)} />
          <Button key="kill-dev" label="Kill all dev" onPress={() => stopAllDev($)} />
        </Box>
      </Box>
    )
  })
}

const COLS = [6, 12, 10, 7, 18, 5]
const line = (cells: string[]) => cells.map((c, i) => c.slice(0, COLS[i]! - 1).padEnd(COLS[i]!)).join('')
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const nameOf = (t: Target) => `${t.command} :${t.port}`
const message = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 120)

async function whoami($: EngineInterface): Promise<string | undefined> {
  const named = (await $.env.get('USER')) ?? (await $.env.get('LOGNAME'))
  if (named) return named
  const r = await $.process.run(['id', '-un'], { timeoutMs: SIGNAL_MS }).catch(() => null)
  return r?.exitCode === 0 ? r.stdout.trim() || undefined : undefined
}

// Everything a kill decision needs, read together. It throws when it cannot tell who you are or which processes belong to this session: with either unknown, nothing may be signalled.
async function snapshot($: EngineInterface): Promise<Snapshot> {
  const me = await whoami($)
  if (!me) throw new Error('cannot tell which user you are')
  const [lsof, ps] = await Promise.all([
    // lsof exits 1 when nothing listens, so only its output counts.
    $.process.run(['lsof', '-nP', '-iTCP', '-sTCP:LISTEN'], { timeoutMs: RUN_MS }),
    $.process.run(PS_SELF, { timeoutMs: RUN_MS }),
  ])
  const own = ancestorPids(ps.stdout)
  if (own.size === 0) throw new Error('cannot tell which processes belong to this session')
  return { listeners: parseLsof(lsof.stdout), me, own }
}

async function refresh($: EngineInterface) {
  try {
    const shown = visible(await snapshot($), await read($, showAll))
    const pids = [...new Set(shown.map(l => l.pid))].join(',')
    const [ps, cwd] = pids
      ? await Promise.all([
          $.process.run(['ps', '-o', 'pid=,etime=', '-p', pids], { timeoutMs: RUN_MS }),
          $.process.run(['lsof', '-a', '-d', 'cwd', '-Fpn', '-p', pids], { timeoutMs: RUN_MS }),
        ])
      : [undefined, undefined]
    const etimes = parseEtimes(ps?.stdout ?? '')
    const cwds = parseCwds(cwd?.stdout ?? '')
    const next: PortRow[] = shown.map(l => ({
      ...l,
      label: label(l),
      project: projectName(cwds.get(l.pid)),
      up: etimes.has(l.pid) ? formatUp(etimes.get(l.pid)!) : '?',
    }))
    await update($, rows, () => next)
    await update($, error, () => null)
  } catch (err) {
    await update($, error, () => `Could not list ports: ${message(err)}`)
  }
}

async function toggleAll($: EngineInterface) {
  await update($, showAll, v => !v)
  await refresh($)
}

// The targets that a fresh listing still shows as the same pid, command and port and that are still allowed to be stopped.
async function stillThere($: EngineInterface, targets: Target[]): Promise<Target[]> {
  const snap = await snapshot($)
  return targets.flatMap(t => {
    const fresh = snap.listeners.find(l => sameTarget(l, t))
    return fresh && !isProtected(fresh, snap.me, snap.own) ? [fresh] : []
  })
}

// kill(1) is run without a shell, so the pid is the only thing that reaches it; it must be a plain integer above 1.
async function signal($: EngineInterface, sig: 'TERM' | 'KILL' | '0', pid: number): Promise<boolean> {
  if (!Number.isInteger(pid) || pid <= 1) return false
  const r = await $.process.run(['kill', `-${sig}`, String(pid)], { timeoutMs: SIGNAL_MS }).catch(() => null)
  return r?.exitCode === 0
}

// SIGTERM, then SIGKILL for what is still alive after the grace period. The target is re-checked against a fresh listing before each signal, so a pid that exited and was reused is never hit.
async function stop($: EngineInterface, targets: Target[]) {
  try {
    const first = await stillThere($, targets)
    if (first.length === 0) {
      $.ui.toast('Already gone, or no longer safe to stop.')
      return await refresh($)
    }
    const failed: Target[] = []
    const termed: Target[] = []
    for (const t of first) {
      if (await signal($, 'TERM', t.pid)) termed.push(t)
      else failed.push(t)
    }
    await $.clock.sleep(GRACE_MS)

    const alive: Target[] = []
    for (const t of termed) if (await signal($, '0', t.pid)) alive.push(t)
    const killable = await stillThere($, alive)
    // Alive but no longer the same listener (it closed its port, or the pid changed hands): left alone rather than guessed at.
    const leftAlone = alive.filter(t => !killable.some(k => sameTarget(k, t)))
    for (const t of killable) if (!(await signal($, 'KILL', t.pid))) failed.push(t)

    const stopped = first.length - failed.length - leftAlone.length
    const notes = [
      failed.length ? `could not signal ${failed.map(nameOf).join(', ')}` : '',
      leftAlone.length ? `left alone: ${leftAlone.map(nameOf).join(', ')}` : '',
    ].filter(Boolean)
    $.ui.toast(`Stopped ${plural(stopped, 'process', 'processes')}${notes.length ? `; ${notes.join('; ')}` : ''}.`)
  } catch (err) {
    $.ui.toast(`Could not stop: ${message(err)}`)
  }
  await refresh($)
}

// ask() rejects when the question is dismissed or nobody can be asked, and says no more than that, so a rejection counts as "no". Only the question itself is covered: every other error reaches the caller's toast.
async function confirm($: EngineInterface, question: string, yes: string): Promise<boolean> {
  const answer = await $.ui.ask(question, [yes, 'Cancel']).catch(() => undefined)
  return answer === yes
}

// With Show all on, the list holds things like databases and editors, so one Kill asks first as Kill all dev does.
async function stopOne($: EngineInterface, target: Target) {
  try {
    if ((await read($, showAll)) && !(await confirm($, `Kill ${nameOf(target)} (pid ${target.pid})?`, 'Kill'))) return
    await stop($, [target])
  } catch (err) {
    $.ui.toast(`Could not stop: ${message(err)}`)
  }
}

async function stopAllDev($: EngineInterface) {
  try {
    const dev = visible(await snapshot($), false)
    if (dev.length === 0) return $.ui.toast('No dev servers to stop.')
    const names = [...new Set(dev.map(nameOf))].join(', ')
    if (await confirm($, `Kill ${plural(dev.length, 'dev server', 'dev servers')}? ${names}`, 'Kill all')) await stop($, dev)
  } catch (err) {
    $.ui.toast(`Could not stop: ${message(err)}`)
  }
}

import { expect, test } from 'claude-code/testing'

import { LSOF, PS } from './fixtures'
import type { Snapshot } from '../hooks/logic'
import type { Listener } from '../types'
import { ancestorPids, formatUp, isDev, isProtected, label, parseCwds, parseEtimes, parseLsof, projectName, sameTarget, visible } from '../hooks/logic'

const snap = (me = 'dev', own: number[] = []): Snapshot => ({ listeners: parseLsof(LSOF), me, own: new Set(own) })

test('parseLsof reads each listener once, whatever the address family', () => {
  const l = parseLsof(LSOF)
  expect(l.filter(x => x.pid === 81234)).toEqual([{ command: 'node', pid: 81234, user: 'dev', port: 5173 }])
  expect(l.some(x => x.command === 'Google Chrome' && x.port === 9222)).toBe(true)
  expect(parseLsof('COMMAND PID USER\nnothing here')).toEqual([])
})

test('dev view lists only dev processes and never AirPlay, Docker or other users', () => {
  const dev = visible(snap(), false)
  expect(dev.map(l => l.port)).toEqual([4300, 5001, 5173, 6006, 8000])
  expect(dev.every(isDev)).toBe(true)
})

test('"Show all" adds other user processes but still hides protected ones', () => {
  const ports = visible(snap(), true).map(l => l.port)
  expect(ports).toContain(5432) // postgres: not dev, but yours
  expect(ports).toContain(9222)
  expect(ports).not.toContain(5000) // AirPlay
  expect(ports).not.toContain(7000)
  expect(ports).not.toContain(2375) // Docker
  expect(ports).not.toContain(57434) // another user's process
  expect(ports).not.toContain(57435) // macOS system daemon, even as you
})

test('Claude Code itself is never listed', () => {
  const listeners = parseLsof('claude   4242 dev 9u IPv4 0xaa 0t0 TCP 127.0.0.1:7777 (LISTEN)\n')
  expect(visible({ listeners, me: 'dev', own: new Set() }, true)).toEqual([])
})

test('labels follow the port, Nx by name', () => {
  const [vite, story, nx, other] = [5173, 6006, 4300, 8000].map(port => parseLsof(LSOF).find(l => l.port === port)!) as [Listener, Listener, Listener, Listener]
  expect([vite, story, nx, other].map(label)).toEqual(['Vite', 'Storybook', 'Nx daemon', ''])
})

test('formatUp, parseEtimes, parseCwds, projectName', () => {
  expect(['00:07', '15:02', '02:03:04', '3-04:05:06', 'x'].map(formatUp)).toEqual(['7s', '15m', '2h', '3d', '?'])
  expect(parseEtimes(' 81234  02:03:04\n 81300     15:02\n')).toEqual(new Map([[81234, '02:03:04'], [81300, '15:02']]))
  expect(parseCwds('p81234\nfcwd\nn/Users/dev/my-app\np81300\nfcwd\nn/Users/dev/other\n')).toEqual(
    new Map([[81234, '/Users/dev/my-app'], [81300, '/Users/dev/other']]),
  )
  expect(projectName('/Users/dev/my-app')).toBe('my-app')
  expect(projectName(undefined)).toBe('-')
})

test('isProtected fails closed when the user is unknown', () => {
  const [node] = parseLsof(LSOF).filter(l => l.pid === 81234)
  expect(isProtected(node!, 'dev', new Set())).toBe(false)
  expect(isProtected(node!, undefined, new Set())).toBe(true)
  expect(visible({ listeners: parseLsof(LSOF), me: undefined as unknown as string, own: new Set() }, true)).toEqual([])
})

test('this session\'s own process and its ancestors are protected', () => {
  expect(ancestorPids(PS)).toEqual(new Set([4300, 4242, 4100]))
  expect(visible(snap('dev', [81234]), false).some(l => l.pid === 81234)).toBe(false)
  // no row for our own ps: we cannot tell who we are, so nothing is assumed
  expect(ancestorPids(' 1 0 /sbin/launchd\n 4242 1 claude\n').size).toBe(0)
})

test('a target is the same only with the same pid, command and port', () => {
  const t = { pid: 81234, command: 'node', port: 5173 }
  expect(sameTarget({ ...t }, t)).toBe(true)
  expect(sameTarget({ ...t, command: 'dotnet' }, t)).toBe(false)
  expect(sameTarget({ ...t, port: 3000 }, t)).toBe(false)
  expect(sameTarget({ ...t, pid: 81235 }, t)).toBe(false)
})

test('the Nx label goes by name, except on 4200 where the port says Angular', () => {
  const l = (command: string, port: number): Listener => ({ command, pid: 5, user: 'dev', port })
  expect(label(l('nx', 4300))).toBe('Nx daemon')
  expect(label(l('nx', 4200))).toBe('Nx/Angular')
  expect(label(l('node', 4200))).toBe('Nx/Angular')
  expect(label(l('nxfoo', 4300))).toBe('')
})

test('dev processes are matched by whole name', () => {
  const dev = (command: string) => isDev({ command, pid: 5, user: 'dev', port: 1 })
  for (const yes of ['node', 'dotnet', 'pnpm', 'npm', 'yarn', 'nx', 'java', 'Python', 'python3.12']) expect(dev(yes)).toBe(true)
  for (const no of ['nodemon', 'javac', 'javaw', 'dotnetfoo', 'pythonista', 'Spotify']) expect(dev(no)).toBe(false)
})

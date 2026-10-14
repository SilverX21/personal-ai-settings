import { expect, mock, test } from 'claude-code/testing'

import { LSOF, PS } from './fixtures'

type Call = { argv: readonly string[]; timeoutMs?: number }

// A machine the tests can change under the mod's feet: which processes listen, who you are, what the ps table says, which signals fail.
function machine(on: any) {
  const m = {
    listing: LSOF,
    ps: PS,
    user: 'dev' as string | undefined,
    lsofThrows: false,
    failing: new Set<string>(), // e.g. 'TERM 81234'
    stubborn: new Set<number>(), // ignore SIGTERM
    dead: new Set<number>(),
    onSignal: (_sig: string, _pid: number) => {},
    answer: 'Kill' as string | undefined, // undefined: the question is dismissed
    asked: [] as string[],
    askThrows: false,
    calls: [] as Call[],
    signals: [] as string[],
    toasts: [] as string[],
  }
  const out = (stdout: string, exitCode = 0) => ({ value: { exitCode, stdout, stderr: '' } })
  on('env.get', (_$: unknown, e: { name: string }) => ({ value: e.name === 'USER' ? m.user : undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('tool.call', { tool: 'AskUserQuestion' }, (_$: unknown, e: { questions: { question: string }[] }) => {
    const question = e.questions[0]!.question
    m.asked.push(question)
    if (m.askThrows) throw new Error('dialog crashed')
    return m.answer === undefined ? { deny: 'dismissed' } : { result: { questions: e.questions, answers: { [question]: m.answer } } }
  })
  on('ui.toast', (_$: unknown, e: { text: string }) => (m.toasts.push(e.text), { value: undefined }))
  on('process.run', (_$: unknown, e: { argv: readonly string[]; init?: { timeoutMs?: number } }) => {
    const [cmd, ...args] = e.argv
    m.calls.push({ argv: e.argv, timeoutMs: e.init?.timeoutMs })
    if (cmd === 'id') return out('', 1)
    if (cmd === 'lsof' && args.includes('-iTCP')) {
      if (m.lsofThrows) throw new Error('lsof: not found')
      return out(m.listing.split('\n').filter(l => !m.dead.has(Number(/^\S+\s+(\d+)/.exec(l)?.[1]))).join('\n'))
    }
    if (cmd === 'lsof') return out('p81234\nfcwd\nn/Users/dev/my-app\np81300\nfcwd\nn/Users/dev/my-app\n')
    if (cmd === 'ps' && args.includes('-axo')) return out(m.ps)
    if (cmd === 'ps') return out('81234 02:03:04\n81300 15:02\n81400 00:30\n81500 01:00:00\n81600 05:00\n')
    if (cmd === 'kill') {
      const sig = args[0]!.slice(1)
      const pid = Number(args[1])
      m.signals.push(`${sig} ${pid}`)
      m.onSignal(sig, pid)
      if (sig === 'TERM' && !m.stubborn.has(pid) && !m.failing.has(`TERM ${pid}`)) m.dead.add(pid)
      if (sig === 'KILL' && !m.failing.has(`KILL ${pid}`)) m.dead.add(pid)
      if (m.failing.has(`${sig} ${pid}`)) return out('', 1)
      return out('', sig === '0' && m.dead.has(pid) ? 1 : 0)
    }
    return out('')
  })
  return m
}

let clock: any
const world = (on: any) => {
  clock = mock.clock(on)
  return machine(on)
}

const open = ($: any) =>
  $.command.run({ command: 'ports-manager', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
const mountPane = ($: any) =>
  $.ui.mount({ plugin: 'ports-manager', surface: 'terminal', component: 'Pane', props: {}, requestId: 'ports-manager' })

// A kill waits out its grace period on the mocked clock, so time moves while the press is in flight.
async function press(ui: any, key: string) {
  const pressed = ui.press({ key })
  await clock.advance(3_000)
  await pressed
}

test('the pane lists dev servers with label, project and uptime, and no AirPlay or Docker', async ($, on) => {
  world(on)
  expect((await open($)).text).toContain('opened')
  const shown = JSON.stringify(await (await mountPane($)).drawn())
  for (const want of ['Vite', 'Storybook', 'my-app', '2h']) expect(shown).toContain(want)
  expect(shown).not.toContain('ControlCe')
  expect(shown).not.toContain('com.docke')
})

test('Kill sends SIGTERM and stops there when the process exits', async ($, on) => {
  const m = world(on)
  await open($)
  await press(await mountPane($), 'kill-81234-5173')
  expect(m.signals).toEqual(['TERM 81234', '0 81234'])
  expect(m.toasts.at(-1)).toBe('Stopped 1 process.')
})

test('a process that ignores SIGTERM gets SIGKILL after the grace period', async ($, on) => {
  const m = world(on)
  m.stubborn.add(81300)
  await open($)
  await press(await mountPane($), 'kill-81300-6006')
  expect(m.signals).toEqual(['TERM 81300', '0 81300', 'KILL 81300'])
})

test('with the user unknown nothing is listed and nothing can be signalled', async ($, on) => {
  const m = world(on)
  m.user = undefined
  await open($)
  const shown = JSON.stringify(await (await mountPane($)).drawn())
  expect(shown).toContain('cannot tell which user you are')
  expect(shown).not.toContain('Vite')
  expect(m.signals).toEqual([])
})

test('if the user becomes unknown between listing and click, the press signals nothing', async ($, on) => {
  const m = world(on)
  await open($)
  const ui = await mountPane($)
  m.user = undefined
  await press(ui, 'kill-81234-5173')
  expect(m.signals).toEqual([])
  expect(m.toasts.at(-1)).toContain('cannot tell which user you are')
})

test('this session\'s own process and its ancestors are never listed or signalled', async ($, on) => {
  const m = world(on)
  m.listing += 'node      4242 dev    40u  IPv4 0x00000000000000ff      0t0  TCP 127.0.0.1:7777 (LISTEN)\n'
  await open($)
  const ui = await mountPane($)
  expect(JSON.stringify(await ui.drawn())).not.toContain('7777')

  // the process shown becomes part of our own chain before the click
  m.ps = ' 1 0 /sbin/launchd\n 81234 1 node\n 4300 81234 ps -axo pid=,ppid=,command=\n'
  await press(ui, 'kill-81234-5173')
  expect(m.signals).toEqual([])
})

test('when the session cannot find itself in ps, nothing is listed', async ($, on) => {
  const m = world(on)
  m.ps = ' 1 0 /sbin/launchd\n'
  await open($)
  const shown = JSON.stringify(await (await mountPane($)).drawn())
  expect(shown).toContain('cannot tell which processes belong to this session')
  expect(shown).not.toContain('Vite')
})

test('a reused pid is never signalled: different command or different port', async ($, on) => {
  const m = world(on)
  await open($)
  const ui = await mountPane($)
  m.listing = m.listing.replace('node      81234', 'dotnet    81234')
  await press(ui, 'kill-81234-5173')
  expect(m.signals).toEqual([])
  expect(m.toasts.at(-1)).toContain('Already gone')

  m.listing = LSOF.replace('127.0.0.1:5173', '127.0.0.1:3000').replace('[::1]:5173', '[::1]:3000')
  await press(ui, 'kill-81234-5173')
  expect(m.signals).toEqual([])
})

test('before SIGKILL the target is checked again: a pid that changed hands is left alone', async ($, on) => {
  const m = world(on)
  m.stubborn.add(81300)
  await open($)
  // after the SIGTERM the original exits and an unrelated python takes the pid
  m.onSignal = (sig, pid) => {
    if (sig === '0' && pid === 81300) m.listing = m.listing.replace('node      81300', 'Python    81300')
  }
  await press(await mountPane($), 'kill-81300-6006')
  expect(m.signals).toEqual(['TERM 81300', '0 81300'])
  expect(m.toasts.at(-1)).toContain('left alone')
})

test('a failed kill is reported, not counted as stopped, and every kill call has a timeout', async ($, on) => {
  const m = world(on)
  m.failing.add('TERM 81234')
  await open($)
  await press(await mountPane($), 'kill-81234-5173')
  expect(m.signals).toEqual(['TERM 81234'])
  expect(m.toasts.at(-1)).toContain('Stopped 0 processes')
  expect(m.toasts.at(-1)).toContain('could not signal node :5173')
  const kills = m.calls.filter(c => c.argv[0] === 'kill')
  expect(kills.length).toBeGreaterThan(0)
  expect(kills.every(c => typeof c.timeoutMs === 'number')).toBe(true)
})

test('a failing lsof during a kill becomes a message, not an unhandled error', async ($, on) => {
  const m = world(on)
  await open($)
  const ui = await mountPane($)
  m.lsofThrows = true
  await press(ui, 'kill-81234-5173')
  expect(m.signals).toEqual([])
  expect(m.toasts.at(-1)).toContain('Could not stop')
})

test('Show all adds your other processes, still without AirPlay, Docker or system daemons', async ($, on) => {
  world(on)
  await open($)
  const ui = await mountPane($)
  expect(JSON.stringify(await ui.drawn())).not.toContain('postgres')
  await ui.press({ key: 'all' })
  const shown = JSON.stringify(await ui.drawn())
  expect(shown).toContain('postgres')
  for (const never of ['ControlCe', 'com.docke', 'rapportd']) expect(shown).not.toContain(never)
})

test('a single Kill asks first in Show all mode and does nothing on Cancel or dismiss', async ($, on) => {
  const m = world(on)
  await open($)
  const ui = await mountPane($)
  await ui.press({ key: 'all' })

  m.answer = 'Cancel'
  await press(ui, 'kill-9694-5432')
  expect(m.asked).toEqual(['Kill postgres :5432 (pid 9694)?'])
  expect(m.signals).toEqual([])

  m.answer = undefined
  await press(ui, 'kill-9694-5432')
  expect(m.signals).toEqual([])

  m.answer = 'Kill'
  await press(ui, 'kill-9694-5432')
  expect(m.signals).toEqual(['TERM 9694', '0 9694'])
})

test('a single Kill does not ask when Show all is off', async ($, on) => {
  const m = world(on)
  await open($)
  await press(await mountPane($), 'kill-81234-5173')
  expect(m.asked).toEqual([])
  expect(m.signals[0]).toBe('TERM 81234')
})

test('Kill all dev asks first, then stops only the dev servers', async ($, on) => {
  const m = world(on)
  await open($)
  const ui = await mountPane($)

  m.answer = 'Cancel'
  await press(ui, 'kill-dev')
  expect(m.signals).toEqual([])
  expect(m.asked[0]).toContain('Kill 5 dev servers?')

  m.answer = 'Kill all'
  await press(ui, 'kill-dev')
  const termed = m.signals.filter(s => s.startsWith('TERM')).map(s => Number(s.split(' ')[1])).sort()
  expect(termed).toEqual([81234, 81300, 81400, 81500, 81600])
})

test('in Show all mode a dev row asks too, and Cancel keeps it alive', async ($, on) => {
  const m = world(on)
  await open($)
  const ui = await mountPane($)
  await ui.press({ key: 'all' })

  m.answer = 'Cancel'
  await press(ui, 'kill-81234-5173')
  expect(m.asked).toEqual(['Kill node :5173 (pid 81234)?'])
  expect(m.signals).toEqual([])

  m.answer = 'Kill'
  await press(ui, 'kill-81234-5173')
  expect(m.signals[0]).toBe('TERM 81234')
})

test('a question that fails counts as no: nothing is killed and nothing is left unhandled', async ($, on) => {
  const m = world(on)
  m.askThrows = true
  await open($)
  const ui = await mountPane($)
  await ui.press({ key: 'all' })
  await press(ui, 'kill-9694-5432')
  await press(ui, 'kill-dev')
  expect(m.asked.length).toBe(2)
  expect(m.signals).toEqual([])
  expect(m.toasts).toEqual([]) // a failed question is a quiet no, not an error message
})

test('errors other than the question reach a toast: Kill all dev with lsof failing', async ($, on) => {
  const m = world(on)
  await open($)
  const ui = await mountPane($)
  m.lsofThrows = true
  await press(ui, 'kill-dev')
  expect(m.asked).toEqual([])
  expect(m.signals).toEqual([])
  expect(m.toasts.at(-1)).toContain('Could not stop')
})

import type { Listener } from '../types'
// What a Kill is aimed at: the process as it was shown. It is only signalled while a fresh listing still shows the same pid, command and port.
export type Target = Pick<Listener, 'pid' | 'command' | 'port'>

export const sameTarget = (l: Target, t: Target): boolean => l.pid === t.pid && l.command === t.command && l.port === t.port

const LABELS: Record<number, string> = {
  5173: 'Vite',
  6006: 'Storybook',
  4200: 'Nx/Angular',
  5000: 'API',
  5001: 'API',
  5341: 'Seq',
}

// Whole names only: nodemon, javac or javaw are not dev servers. `python3.12` and friends are.
const DEV = /^(node|dotnet|pnpm|npm|yarn|nx|python[\d.]*|java)$/i
// lsof cuts COMMAND to 9 characters, so these are prefixes. Claude Code itself is included so it can never be listed or killed from here.
const NEVER = /^(controlce|com\.docke|docker|vpnkit|launchd|mdnsresp|kernel_ta|windowse|rapportd|sharingd|claude)/i

// Lines look like: `node 81234 dev 23u IPv4 0x… 0t0 TCP *:5173 (LISTEN)`; a process listening on IPv4 and IPv6 yields two lines.
export function parseLsof(text: string): Listener[] {
  const seen = new Set<string>()
  const out: Listener[] = []
  for (const line of text.split('\n')) {
    const m = /^(\S+)\s+(\d+)\s+(\S+)\s.*\sTCP\s+(\S+)\s+\(LISTEN\)\s*$/.exec(line)
    if (!m) continue
    const port = Number(m[4]!.slice(m[4]!.lastIndexOf(':') + 1))
    const key = `${m[2]}:${port}`
    if (!Number.isInteger(port) || seen.has(key)) continue
    seen.add(key)
    out.push({ command: m[1]!.replace(/\\x20/g, ' '), pid: Number(m[2]), user: m[3]!, port })
  }
  return out
}

// Never listed, never killed, whatever "Show all" says: system and desktop processes, other users' processes, and this session's own process chain.
// Fails closed: with no known user every process counts as someone else's.
export function isProtected(l: Listener, me: string | undefined, own: ReadonlySet<number>): boolean {
  return NEVER.test(l.command) || me === undefined || l.user !== me || l.pid <= 1 || own.has(l.pid)
}

export const isDev = (l: Listener): boolean => DEV.test(l.command)

export type Snapshot = { listeners: Listener[]; me: string; own: ReadonlySet<number> }

export function visible(snap: Snapshot, showAll: boolean): Listener[] {
  return snap.listeners.filter(l => !isProtected(l, snap.me, snap.own) && (showAll || isDev(l))).sort((a, b) => a.port - b.port)
}

// The same `ps` call that lists the processes is how this session finds itself: the row for that very command is our child, so its ppid chain is the host and everything above it.
export const PS_SELF = ['ps', '-axo', 'pid=,ppid=,command=']

export function ancestorPids(psText: string, selfCommand = PS_SELF.join(' ')): Set<number> {
  const parent = new Map<number, number>()
  const selves: number[] = []
  for (const line of psText.split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s+(.*?)\s*$/.exec(line)
    if (!m) continue
    parent.set(Number(m[1]), Number(m[2]))
    if (m[3] === selfCommand) selves.push(Number(m[1]))
  }
  const out = new Set<number>()
  for (const self of selves) {
    for (let pid = parent.get(self); pid !== undefined && pid > 1 && !out.has(pid); pid = parent.get(pid)) out.add(pid)
    out.add(self)
  }
  return out
}

// A process named nx is the Nx daemon, except on 4200, where the port says it is an Angular dev server.
export function label(l: Listener): string {
  if (/^nx$/i.test(l.command) && l.port !== 4200) return 'Nx daemon'
  return LABELS[l.port] ?? ''
}

// `ps -o etime=` prints [[dd-]hh:]mm:ss.
export function formatUp(etime: string): string {
  const m = /^\s*(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)\s*$/.exec(etime)
  if (!m) return '?'
  const [d, h, min, s] = [Number(m[1] ?? 0), Number(m[2] ?? 0), Number(m[3]), Number(m[4])]
  if (d) return `${d}d`
  if (h) return `${h}h`
  return min ? `${min}m` : `${s}s`
}

// `ps -o pid=,etime= -p 1,2` → pid → etime.
export function parseEtimes(text: string): Map<number, string> {
  const out = new Map<number, string>()
  for (const line of text.split('\n')) {
    const m = /^\s*(\d+)\s+(\S+)\s*$/.exec(line)
    if (m) out.set(Number(m[1]), m[2]!)
  }
  return out
}

// `lsof -a -d cwd -Fpn -p 1,2` prints `p<pid>` then `n<path>` per process.
export function parseCwds(text: string): Map<number, string> {
  const out = new Map<number, string>()
  let pid = 0
  for (const line of text.split('\n')) {
    if (line.startsWith('p')) pid = Number(line.slice(1))
    else if (line.startsWith('n') && pid) out.set(pid, line.slice(1))
  }
  return out
}

export const projectName = (cwd: string | undefined): string => cwd?.split('/').filter(Boolean).pop() ?? '-'

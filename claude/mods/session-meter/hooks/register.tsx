import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Meter, PendingHandoff } from '../types'
import { bar, cacheState, cacheTone, contextTone, minutesLeft, prettyModel, ttlFromUsage } from './logic'

const WARN_PERCENT = 45
const COLD_TIP_PERCENT = 40
const DEFAULT_TTL = 60
const TICK_MS = 15_000
const REFILL_WINDOW_MS = 30 * 60_000

const INITIAL: Meter = {
  sessionId: '',
  model: '',
  percent: null,
  tokens: null,
  lastTouch: null,
  now: 0,
  ttlMin: DEFAULT_TTL,
  ttlSource: 'default',
  overageLikely: false,
  warned: false,
  handoff: 'idle',
  handoffPath: '',
}
const meter = atom({ plugin: 'session-meter', key: 'meter' } as const, INITIAL)

// Last cache-write bucket in this session's transcript (D24). Read with tail: transcripts outgrow $.fs.read's 4 MiB cap.
const TRANSCRIPT_SCRIPT = `f=$(ls "\${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/projects/*/"$1".jsonl 2>/dev/null | head -1)
[ -n "$f" ] && tail -c 400000 "$f" | grep -oE '"ephemeral_(5m|1h)_input_tokens":[0-9]+' | tail -2`

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'session-meter',
      description: 'Session meter: ttl 5 | 60 | auto, or handoff',
      argumentHint: 'ttl 5|60|auto | handoff',
    })
    $.clock.every(TICK_MS, () => void refresh($).catch(() => undefined))
    void refresh($).catch(() => undefined)
    return next(e)
  })

  on('command.run', { command: 'session-meter' }, async ($, e) => {
    const [verb, value] = e.args.trim().split(/\s+/)
    if (verb === 'handoff') {
      void startHandoff($)
      return { text: 'Preparing a handoff…' }
    }
    if (verb === 'ttl' && (value === '5' || value === '60')) {
      await update($, meter, (m): Meter => ({ ...m, ttlMin: Number(value), ttlSource: 'manual' }))
      return { text: `Cache TTL set to ${value} min for this session.` }
    }
    if (verb === 'ttl' && value === 'auto') {
      await update($, meter, (m): Meter => ({ ...m, ttlSource: 'default', ttlMin: DEFAULT_TTL }))
      return { text: 'Cache TTL back to auto-detect.' }
    }
    return { text: 'Usage: /session-meter ttl 5|60|auto  ·  /session-meter handoff' }
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result

    const now = await $.clock.now()
    await update($, meter, (m): Meter => ({ ...m, lastTouch: now, now }))
    await detectTtl($).catch(() => undefined)
    if ((await read($, meter)).handoff === 'running') await finishHandoff($)
    await refresh($).catch(() => undefined)
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const m = await read($, meter)
    if (e.props.hasSurvey || m.model === '') return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)

    const remaining = e.props.isWorking || m.lastTouch === null ? m.ttlMin * 60_000 : m.ttlMin * 60_000 - (m.now - m.lastTouch)
    const state = cacheState(remaining, m.ttlMin)
    const percent = m.percent === null ? null : Math.round(m.percent)
    const isWarn = percent !== null && percent >= WARN_PERCENT
    const isColdAndBig = state === 'Cold' && percent !== null && percent >= COLD_TIP_PERCENT

    return (
      <Box flexDirection="row" flexWrap="wrap">
        <Text color="claude">{prettyModel(m.model)}</Text>
        <Text dimColor> · </Text>
        {percent === null ? (
          <Text dimColor>ctx –</Text>
        ) : (
          <Text color={contextTone(percent, WARN_PERCENT)} bold={isWarn}>
            ctx {percent}% {bar(percent)}
          </Text>
        )}
        <Text dimColor> · </Text>
        <Text color={cacheTone(state)}>
          cache {state} {e.props.isWorking ? 'working' : minutesLeft(remaining)}
        </Text>
        {m.ttlSource === 'manual' && <Text dimColor> (ttl {m.ttlMin}m)</Text>}
        {m.overageLikely && <Text color="warning"> · overage likely: cache may drop to 5m</Text>}
        {isColdAndBig && m.tokens !== null && (
          <Text color="warning"> · next message rewrites ~{Math.round(m.tokens / 1000)}k tokens; consider a handoff</Text>
        )}
        {isWarn && m.handoff === 'idle' && (
          <>
            <Text color="warning">   ⚠ time to hand off </Text>
            <Button key="handoff" label="Prepare handoff" variant="primary" onPress={() => void startHandoff($)} />
          </>
        )}
        {m.handoff === 'running' && <Text dimColor>   preparing handoff…</Text>}
        {m.handoff === 'ready' && <Text color="success">   handoff copied ✓ · /clear to start fresh</Text>}
      </Box>
    )
  })
}

async function refresh($: EngineInterface): Promise<void> {
  const [sessionId, model, usage, now] = await Promise.all([$.session.id(), $.session.model(), $.session.usage(), $.clock.now()])
  const { context } = usage
  const percent = context.percent ?? (context.tokens !== undefined && context.window > 0 ? (context.tokens / context.window) * 100 : null)
  const overageLikely = usage.rateLimits.some(r => r.percentUsed >= 100)

  const before = await read($, meter)
  const isNewSession = before.sessionId !== '' && before.sessionId !== sessionId
  const base = isNewSession ? { ...INITIAL, ttlMin: before.ttlMin, ttlSource: before.ttlSource } : before
  const shouldWarn = percent !== null && percent >= WARN_PERCENT && !base.warned

  await update($, meter, (m): Meter => ({
    ...(isNewSession ? base : m),
    sessionId,
    model,
    percent,
    tokens: context.tokens ?? null,
    now,
    overageLikely,
    warned: base.warned || shouldWarn,
  }))
  if (shouldWarn) $.ui.toast(`Context at ${Math.round(percent!)}%: time to prepare a handoff.`)
  await refillHandoff($, sessionId, now)
}

async function detectTtl($: EngineInterface): Promise<void> {
  if ((await read($, meter)).ttlSource === 'manual') return
  const id = await $.session.id()
  const { stdout } = await $.process.run(['/bin/sh', '-c', TRANSCRIPT_SCRIPT, 'sh', id], { timeoutMs: 5_000 })
  const ttl = ttlFromUsage(stdout)
  if (ttl !== null) await update($, meter, (m): Meter => ({ ...m, ttlMin: ttl, ttlSource: 'detected' }))
}

async function startHandoff($: EngineInterface): Promise<void> {
  if ((await read($, meter)).handoff === 'running') return
  const [id, tmp, branchRun] = await Promise.all([
    $.session.id(),
    $.env.get('TMPDIR'),
    $.process.run(['git', 'branch', '--show-current'], { timeoutMs: 5_000 }).catch(() => ({ stdout: '' })),
  ])
  const path = `${(tmp ?? '/tmp').replace(/\/$/, '')}/claude-handoff-${id}.md`
  const branch = branchRun.stdout.trim()
  const args = `Continue this work${branch ? ` on branch ${branch}` : ''} in a fresh session. Save the handoff document to exactly this path: ${path}`
  await update($, meter, (m): Meter => ({ ...m, handoff: 'running', handoffPath: path }))
  try {
    await $.command.run({ command: 'handoff', args })
  } catch {
    // Fallback when /handoff isn't a registered command here: submit it as a typed prompt.
    await $.prompt.submit({ text: `/handoff ${args}` })
  }
}

async function finishHandoff($: EngineInterface): Promise<void> {
  const { handoffPath } = await read($, meter)
  if (!(await $.fs.exists(handoffPath))) {
    await update($, meter, (m): Meter => ({ ...m, handoff: 'idle' }))
    $.ui.toast(`Handoff file not found at ${handoffPath}. Copy it from the answer above.`)
    return
  }
  const text = await $.fs.read(handoffPath)
  const copied = await $.ui.copy({ text })
  const pending: PendingHandoff = { text, at: await $.clock.now(), fromSession: await $.session.id(), isUsed: false }
  await $.store.set(`handoff:${await $.session.cwd()}`, pending)
  await update($, meter, (m): Meter => ({ ...m, handoff: 'ready' }))
  $.ui.toast(copied.isCopied ? 'Handoff copied. Run /clear: the prompt will be pre-filled.' : `Handoff saved to ${handoffPath}.`)
}

// After /clear (new session id, same cwd), put the saved handoff in an empty prompt box.
async function refillHandoff($: EngineInterface, sessionId: string, now: number): Promise<void> {
  const key = `handoff:${await $.session.cwd()}`
  const pending = (await $.store.get(key)) as PendingHandoff | undefined
  if (!pending || pending.isUsed || pending.fromSession === sessionId || now - pending.at > REFILL_WINDOW_MS) return
  if ((await $.prompt.read()).text !== '') return
  const { isFilled } = await $.prompt.fill({ text: pending.text, mode: 'replace' })
  if (!isFilled) return
  await $.store.set(key, { ...pending, isUsed: true })
  $.ui.toast('Handoff pre-filled: press Enter to continue.')
}

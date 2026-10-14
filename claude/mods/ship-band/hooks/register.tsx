import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { View, Where } from '../types'
import { SKILL_STEP, SOURCES, apply, bashSignal, current, editSignal, formatLine, nextText, skillName } from './logic'
import type { Signal, Source, Steps } from './logic'

const view = atom({ plugin: 'ship-band', key: 'view' } as const, null)
const isHidden = atom({ plugin: 'ship-band', key: 'isHidden' } as const, false)
const STORE_KEY = 'branches'
const STORE_CAP = 50
const SOURCE_KEY = 'sources'
const SOURCE_LABELS: Record<string, Source> = {
  'Azure DevOps': 'azure',
  'GitHub issues': 'github',
  'Nowhere (hide the WI step)': 'none',
}

const pending = atom({ plugin: 'ship-band', key: 'pending' } as const, {})
const where = atom({ plugin: 'ship-band', key: 'where' } as const, null)
const isAsked = atom({ plugin: 'ship-band', key: 'isAsked' } as const, false)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'ship-band',
      description: 'Delivery-step band: show | reset | off | on | source [azure|github|none]',
      argumentHint: 'show | reset | off | on | source [azure|github|none]',
    })
    await refresh($)
    return next(e)
  })

  on('command.run', { command: 'ship-band' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'off' || arg === 'on') {
      await update($, isHidden, () => arg === 'off')
      return { text: `ship-band is ${arg}.` }
    }
    if (arg === 'reset') {
      await save($, (await locate($))?.key, {})
      await refresh($)
      return { text: 'Steps cleared for this branch.' }
    }
    if (arg === 'source' || arg.startsWith('source ')) {
      const root = (await locate($))?.root
      if (!root) return { text: 'Not in a git repository.' }
      const given = arg.slice('source'.length).trim() as Source
      if (!given) {
        await askSource($, root)
      } else if (SOURCES.includes(given)) {
        await setSource($, root, given)
        await refresh($)
      } else return { text: `Unknown source "${given}". Use: ${SOURCES.join(' | ')}` }
      return { text: `Work items for this repo: ${(await sourceOf($, root)) ?? 'not set'}.` }
    }
    const v = await read($, view)
    return { text: v ? formatLine(v.branch, v.steps, v.source) : 'Not in a git repository.' }
  })

  // Bookkeeping must never block a prompt or a tool call, so each gating hook falls back to passing through.
  on('prompt.submit', async ($, e, next) => {
    const name = e.command ? skillName(e.command.name) : undefined
    if (name === 'azure-wi') await record($, { kind: 'azure-wi' })
    else if (name && name in SKILL_STEP) await startSkill($, name)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Skill' }, async ($, e, next) => {
    const name = skillName(e.skill)
    if (name in SKILL_STEP) await startSkill($, name)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'ExitPlanMode' }, async ($, e, next) => {
    const r = await next(e)
    if (r.deny === undefined && r.isError !== true) await record($, { kind: 'plan' })
    return r
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: ['Edit', 'Write'] }, async ($, e, next) => {
    const r = await next(e)
    if (r.deny === undefined && r.isError !== true) await recordEdit($, e.file_path)
    return r
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const r = await next(e)
    if (r.deny !== undefined) return r
    const signal = bashSignal(e.command, r.isError === true, r.text ?? '')
    if (signal === 'branch-changed') await refresh($)
    else if (signal) await record($, signal)
    return r
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const done = Object.entries(await read($, pending))
    await update($, pending, () => ({}))
    if (e.reason === 'answer') for (const [skill, isStale] of done) await record($, { kind: 'skill', skill, isStale })
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    const v = await read($, view)
    if (e.props.hasSurvey || !v || (await read($, isHidden))) return below

    const { Box, Button, Text } = $.ui.resolve(e)
    const cur = current(v.steps, v.source)
    const text = cur ? nextText(cur, v.source, v.steps) : undefined
    const hasPr = v.steps.PR === 'done' && v.steps.Merged !== 'done'

    // Keep what the hooks below drew (other bands) instead of replacing it.
    return (
      <Box flexDirection="column">
        {below}
        <Box>
        <Text dimColor>{formatLine(v.branch, v.steps, v.source)} </Text>
        {text ? <Button key="next" label={`Next: ${text.trim()}`} onPress={() => $.prompt.fill({ text })} /> : null}
        {hasPr ? <Button key="merged" label="Mark merged" onPress={() => record($, { kind: 'merged' })} /> : null}
        </Box>
      </Box>
    )
  })
}

// Branch changes are rare, so the branch is looked up on session start and after git checkout/switch only.
async function locate($: EngineInterface): Promise<Where | undefined> {
  const root = (await $.session.repo())?.root
  // A failed or slow git call just means no branch: the band stays hidden rather than breaking the hook.
  const r = await $.process.run(['git', 'branch', '--show-current'], { timeoutMs: 2_000 }).catch(() => null)
  const branch = r?.stdout.trim()
  const at = root && branch ? { key: `${root}:${branch}`, branch, root } : null
  await update($, where, () => at)
  return at ?? undefined
}

async function load($: EngineInterface): Promise<Record<string, Steps>> {
  return ((await $.store.get(STORE_KEY)) as Record<string, Steps> | undefined) ?? {}
}

async function save($: EngineInterface, key: string | undefined, steps: Steps) {
  if (!key) return
  const all = await load($)
  // Re-adding the key moves it to the newest slot, so the branch in use is never the one evicted.
  const { [key]: _old, ...others } = all
  const kept = Object.entries({ ...others, [key]: steps }).slice(-STORE_CAP)
  await $.store.set(STORE_KEY, Object.fromEntries(kept))
}

async function sourceOf($: EngineInterface, root: string): Promise<Source | undefined> {
  return ((await $.store.get(SOURCE_KEY)) as Record<string, Source> | undefined)?.[root]
}

async function setSource($: EngineInterface, root: string, source: Source) {
  const all = ((await $.store.get(SOURCE_KEY)) as Record<string, Source> | undefined) ?? {}
  await $.store.set(SOURCE_KEY, { ...all, [root]: source })
}

async function askSource($: EngineInterface, root: string) {
  try {
    const answer = await $.ui.ask("Where do this repo's work items live?", { header: 'Work items', options: Object.keys(SOURCE_LABELS) })
    const source = SOURCE_LABELS[answer]
    if (!source) return
    await setSource($, root, source)
    await refresh($)
  } catch {
    // Dismissing the question (or no one to ask) is a valid answer: leave the source unset and keep the band working.
  }
}

async function show($: EngineInterface, at: Where, steps: Steps) {
  const v: View = { key: at.key, branch: at.branch, source: (await sourceOf($, at.root)) ?? 'azure', steps }
  await update($, view, () => v)
}

async function refresh($: EngineInterface) {
  const at = await locate($)
  if (!at) return update($, view, () => null)
  const source = await sourceOf($, at.root)
  const steps = apply((await load($))[at.key] ?? {}, { kind: 'branch', branch: at.branch, source: source ?? 'azure' })
  await save($, at.key, steps)
  await show($, at, steps)
  if (!source && !(await read($, isAsked))) {
    await update($, isAsked, () => true)
    // Not awaited: the dialog waits for the person, and session start must not.
    void askSource($, at.root)
  }
}

async function record($: EngineInterface, signal: Signal) {
  const at = (await read($, where)) ?? (await locate($))
  if (!at) return
  const steps = apply((await load($))[at.key] ?? {}, signal)
  await save($, at.key, steps)
  await show($, at, steps)
}

async function startSkill($: EngineInterface, name: string) {
  await update($, pending, p => ({ ...p, [name]: false }))
}

async function recordEdit($: EngineInterface, path: string) {
  const signal = editSignal(path)
  if (!signal) return
  await update($, pending, p => Object.fromEntries(Object.keys(p).map(k => [k, true])))
  await record($, signal)
}

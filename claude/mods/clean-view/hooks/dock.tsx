import { atom, read, update } from 'claude-code'
import type { EngineInterface, On, Timer } from 'claude-code'

import type { DockHelper, DockHelperModel, DockMission, DockSettings } from '../types'
import {
  BAD_NUMBER,
  CORAL,
  GOLD,
  GREEN,
  HAIRLINE,
  HELPER_PLAN,
  RED,
  SIZES,
  SIZE_HINT,
  STOPPED,
  TILE_FROM,
  TILE_WIDTH,
  TOO_NARROW,
  atOnce,
  badge,
  blend,
  capDenial,
  cardsPerRow,
  clampPercent,
  clock,
  counts,
  faceColor,
  faceFile,
  finishHelper,
  infoLine,
  initials,
  isBigTeam,
  isComplete,
  isLive,
  jobName,
  linkAgent,
  meter,
  missionPercent,
  missionSegments,
  needsNudge,
  newMission,
  nudgeText,
  parseSize,
  queueHelpers,
  reportProgress,
  restoreSize,
  seatGlows,
  spaced,
  splitInstruction,
  startHelper,
  summary,
  taskName,
  tilesPerRow,
} from './dock-logic'

type $ = EngineInterface

const PANE = 'agent-dock'
const PANE_COLUMNS = 78
const PLAN_TOOL = 'mcp__clean-view__plan_steps'
const REPORT_TOOL = 'mcp__clean-view__report_progress'
const SIZE_KEY = 'dock.size'
const MODEL_KEY = 'panel.helperModel'
const DOCK_BUTTON = 'agent-dock-open'

const DEFAULTS: DockSettings = { size: 1, helperModel: 'fast', pendingSize: null, isCustomOpen: false, isFolded: false }

const settingsAtom = atom({ plugin: 'clean-view', key: 'dockSettings' } as const, DEFAULTS)
const missionAtom = atom({ plugin: 'clean-view', key: 'dockMission' } as const, null)
const tickAtom = atom({ plugin: 'clean-view', key: 'dockTick' } as const, 0)

// These start over on a reload; the dock itself lives in $.state.
let ticker: Timer | undefined
let running = 0
let lastAgentsNow = -1

// ── State ─────────────────────────────────────────────────────────────────

async function settingsOf($: $): Promise<DockSettings> {
  return { ...DEFAULTS, ...((await read($, settingsAtom)) ?? {}) }
}

async function setSettings($: $, fn: (settings: DockSettings) => DockSettings) {
  await update($, settingsAtom, settings => fn({ ...DEFAULTS, ...(settings ?? {}) }))
  await syncStatus($)
}

async function setMission($: $, fn: (mission: DockMission | null) => DockMission | null) {
  await update($, missionAtom, mission => fn(mission ?? null))
  await syncClock($)
  await syncStatus($)
  await syncAgentsNow($)
}

/** One clock, and only while helpers are queued or working. */
async function syncClock($: $) {
  const shouldTick = isLive(await read($, missionAtom))
  if (shouldTick && ticker === undefined) {
    ticker = $.clock.every(250, () => void update($, tickAtom, n => ((n ?? 0) + 1) % 1_000_000))
  } else if (!shouldTick && ticker !== undefined) {
    ticker.cancel()
    ticker = undefined
  }
}

/** The status-bar badge, shown while the dock is folded. */
async function syncStatus($: $) {
  const settings = await settingsOf($)
  if (!settings.isFolded) {
    $.ui.status(undefined)
    return
  }
  const mission = await read($, missionAtom)
  if (mission !== null && isLive(mission)) {
    $.ui.status(`◆ ${badge(counts(mission.helpers))}`)
  } else if (mission !== null && isComplete(mission)) {
    $.ui.status(`◆ ${summary(mission)}`)
  } else {
    $.ui.status(`◆ Dock · team of ${settings.size} standing by`)
  }
}

/** The status line's "◇ N agents" reads this file: helpers run in-process, so no process count sees them. */
async function syncAgentsNow($: $) {
  const mission = await read($, missionAtom)
  const working = mission === null ? 0 : counts(mission.helpers).working
  if (working === lastAgentsNow) {
    return
  }
  lastAgentsNow = working
  try {
    const home = await $.env.get('HOME')
    const sessionId = await $.session.id()
    if (home === undefined) {
      return
    }
    const queued = mission === null ? 0 : counts(mission.helpers).queued
    await $.fs.write(
      `${home}/.claude/ai-employee-kit-data/agents-now/${sessionId}.json`,
      JSON.stringify({ agents: working, queued, updatedAt: await $.clock.now() }),
    )
  } catch {
    // The count is a nicety for the status line; the dock works without it.
  }
}

// ── Opening, folding, choosing a size ───────────────────────────────────

async function openDock($: $) {
  const opened = await $.ui.open({ id: PANE, title: 'Agent Dock', columns: PANE_COLUMNS })
  if (!opened.isPlaced) {
    $.ui.toast(TOO_NARROW)
  }
  await setSettings($, settings => ({ ...settings, isFolded: false }))
}

async function toggleDock($: $) {
  const isUp = (await $.ui.panes()).some(pane => pane.id === PANE)
  if (isUp) {
    await $.ui.close({ id: PANE })
    await setSettings($, settings => ({ ...settings, isFolded: true }))
  } else {
    await openDock($)
  }
}

async function chooseSize($: $, size: number) {
  if (isBigTeam(size)) {
    await setSettings($, settings => ({ ...settings, pendingSize: size, isCustomOpen: false }))
    return
  }
  await setSettings($, settings => ({ ...settings, size, pendingSize: null, isCustomOpen: false }))
  await $.store.set(SIZE_KEY, size)
}

async function confirmSize($: $) {
  const { pendingSize } = await settingsOf($)
  if (pendingSize === null) {
    return
  }
  await setSettings($, settings => ({ ...settings, size: pendingSize, pendingSize: null }))
  // Saved anyway; a big team resets to 1 when the next session reads it.
  await $.store.set(SIZE_KEY, pendingSize)
}

async function chooseModel($: $, helperModel: DockHelperModel) {
  await setSettings($, settings => ({ ...settings, helperModel }))
  await $.store.set(MODEL_KEY, helperModel)
}

async function concurrency($: $): Promise<number> {
  return atOnce(
    await $.env.get('CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS'),
    await $.env.get('CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY'),
  )
}

async function canDrawImages($: $): Promise<boolean> {
  const term = (await $.env.get('TERM')) ?? ''
  const program = (await $.env.get('TERM_PROGRAM')) ?? ''

  return /kitty|ghostty/i.test(term) || /kitty|ghostty/i.test(program)
}

// ── Hooks ─────────────────────────────────────────────────────────────────

export function registerAgentDock(on: On) {
  // Clean View already owns the plain matchers of the events both use: these
  // catch-all matchers keep each one's hook its own.
  on('session.start', { cwd: /^/ }, async ($, e, next) => {
    await $.command.register({
      name: 'dock',
      description: 'Show or fold the Agent Dock, or set the Team Size',
      argumentHint: '1-100',
    })
    const size = restoreSize(await $.store.get(SIZE_KEY))
    const savedModel = await $.store.get(MODEL_KEY)
    const helperModel: DockHelperModel = savedModel === 'same' ? 'same' : 'fast'
    await update($, settingsAtom, settings => ({ ...DEFAULTS, ...(settings ?? {}), size, helperModel, pendingSize: null }))
    await $.store.set(SIZE_KEY, size)
    await syncClock($)

    return next(e)
  })

  on('command.run', { command: 'dock' }, ($, e) => {
    try {
      const arg = e.args.trim()
      if (arg === '') {
        void toggleDock($).catch(() => $.ui.toast(TOO_NARROW))
        return { text: 'Agent Dock: toggled.' }
      }
      const size = parseSize(arg)
      if (size === null) {
        return { text: SIZE_HINT }
      }
      void (async () => {
        await openDock($)
        await chooseSize($, size)
      })().catch(() => undefined)

      return { text: isBigTeam(size) ? `Confirm the team of ${size} in the Agent Dock.` : `Team Size is ${size}.` }
    } catch {
      return { text: 'The Agent Dock could not answer. Try /dock again.' }
    }
  })

  on('ui.close', { id: PANE }, async ($, e, next) => {
    const closed = await next(e)
    await setSettings($, settings => ({ ...settings, isFolded: true }))

    return closed
  })

  on('prompt.submit', { text: /^/ }, async ($, e, next) => {
    const isOwnOrNotice = e.origin?.kind === 'plugin' || e.origin?.kind === 'task-notification'
    if (e.command !== undefined || e.isMeta === true || isOwnOrNotice || e.turnId !== undefined) {
      return next(e)
    }
    const { size } = await settingsOf($)
    const now = await $.clock.now()
    await setMission($, () => newMission(jobName(e.text), size, now))
    if (size <= 1) {
      return next(e)
    }

    return next({ ...e, context: [...(e.context ?? []), splitInstruction(size)] })
  })

  // Cards appear as soon as the model writes its Agent calls, before they run.
  on('session.append', { door: 'response' }, async ($, e, next) => {
    if (e.agentId === undefined && Array.isArray(e.message.content)) {
      const calls = (e.message.content as ReadonlyArray<Record<string, unknown>>)
        .filter(block => block.type === 'tool_use' && block.name === 'Agent')
        .map(block => ({
          id: String(block.id),
          description: (block.input as { description?: unknown } | undefined)?.description,
        }))
      if (calls.length > 0) {
        const now = await $.clock.now()
        const { size } = await settingsOf($)
        await setMission($, mission => queueHelpers(mission ?? newMission('Your request', size, now), calls))
      }
    }

    return next(e)
  })

  // Helpers report here before Clean View's own hook would answer them.
  on('tool.call', { tool: [REPORT_TOOL, PLAN_TOOL], agentId: /./ }, async ($, e) => {
    if (String(e.tool) === PLAN_TOOL) {
      return { result: HELPER_PLAN }
    }
    const percent = clampPercent((e as unknown as { percent?: unknown }).percent)
    const agentId = e.agentId ?? ''
    const mission = await read($, missionAtom)
    const isLinked = mission?.helpers.some(helper => helper.agentId === agentId) ?? false
    if (mission !== null && !isLinked) {
      // A spawn the dock did not see: find the card by the agent's own description.
      const agent = (await $.agent.list()).find(one => one.id === agentId)
      const name = agent === undefined ? '' : taskName(agent.description)
      const card = mission.helpers.find(helper => helper.agentId === null && helper.status === 'working' && helper.name === name)
      if (card !== undefined) {
        await setMission($, one => (one === null ? one : linkAgent(one, card.id, agentId)))
      }
    }
    await setMission($, one => (one === null ? one : reportProgress(one, agentId, percent)))

    return { result: `Progress noted: ${percent}%.` }
  })

  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    if (e.agentId !== undefined || e.tool !== 'Agent') {
      return next(e)
    }
    const id = e.tool_use_id
    const settings = await settingsOf($)
    const startedAt = await $.clock.now()
    let size = settings.size
    let isOverCap = false
    await setMission($, current => {
      const mission = current ?? newMission('Your request', settings.size, startedAt)
      size = mission.size
      isOverCap = size > 1 && mission.launched >= size
      if (isOverCap) {
        return { ...mission, helpers: mission.helpers.filter(helper => helper.id !== id) }
      }

      return queueHelpers({ ...mission, launched: mission.launched + 1 }, [{ id, description: e.description }])
    })
    if (isOverCap) {
      return { deny: capDenial(size) }
    }

    // The engine refuses an Agent call past its limit instead of queueing it,
    // so the dock holds the call here. A process sleep keeps the hook's own
    // budget untouched, where $.clock.sleep would spend it.
    const limit = await concurrency($)
    while (running >= limit && !next.signal.aborted) {
      await $.process.run(['/bin/sleep', '1']).catch(() => undefined)
    }
    if (next.signal.aborted) {
      const now = await $.clock.now()
      await setMission($, mission => (mission === null ? mission : finishHelper(mission, id, true, now)))
      return { deny: STOPPED }
    }

    running += 1
    let isStuck = true
    try {
      await setMission($, mission => (mission === null ? mission : startHelper(mission, id, startedAt)))
      const isFast = settings.helperModel === 'fast' && size > 1 && e.model === undefined
      const ran = await next(isFast ? { ...e, model: 'haiku' } : e)
      isStuck = ran.deny !== undefined || ran.isError === true

      return ran
    } finally {
      running = Math.max(0, running - 1)
      const now = await $.clock.now()
      await setMission($, mission => (mission === null ? mission : finishHelper(mission, id, isStuck, now)))
    }
  })

  // Ties each helper's own loop to its card, so its reports find it.
  on('agent.spawn', async ($, e, next) => {
    const spawned = await next(e)
    const agentId = spawned.agentId
    if (agentId !== undefined && e.tool_use_id !== '') {
      await setMission($, mission => (mission === null ? mission : linkAgent(mission, e.tool_use_id, agentId)))
    }

    return spawned
  })

  on('turn.complete', { reason: /^/ }, async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId !== undefined) {
      return ran
    }
    const mission = await read($, missionAtom)
    if (mission === null) {
      return ran
    }

    if (e.reason === 'answer' && needsNudge(mission, mission.size)) {
      const text = nudgeText(mission.launched, mission.size)
      await setMission($, one => (one === null ? one : { ...one, isNudged: true }))
      void $.prompt.submit({ text }).catch(() => undefined)
      return ran
    }
    if (mission.helpers.length === 0) {
      await setMission($, () => null)
      return ran
    }

    const now = await $.clock.now()
    await setMission($, one => {
      if (one === null) {
        return one
      }
      const settled = one.helpers.reduce(
        (acc, helper) =>
          helper.status === 'queued' || helper.status === 'working' ? finishHelper(acc, helper.id, true, now) : acc,
        one,
      )

      return { ...settled, finishedAt: now }
    })

    return ran
  })

  on('session.end', async ($, e, next) => {
    running = 0
    await setMission($, () => null)

    return next(e)
  })

  // The ◆ Dock button sits beside Clean View's own toggle above the prompt.
  on('ui.render', { component: 'AbovePrompt', props: { hasSurvey: false } }, async ($, e, next) => {
    const band = await next(e)
    const { Box, Button } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" alignItems="flex-start">
        <Box flexGrow={1} flexShrink={1} flexDirection="column">
          {band}
        </Box>
        <Button key={DOCK_BUTTON} label="◆ Dock" onPress={() => void toggleDock($)} />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Button, Text } = ui
    const settings = await settingsOf($)
    const mission = await read($, missionAtom)
    const tick = (await read($, tickAtom)) ?? 0
    const now = await $.clock.now()
    const cols = Math.max(30, e.props.bodyColumns)
    const showImages = e.surface === 'terminal' && (await canDrawImages($))
    const Input = 'Input' in ui ? ui.Input : undefined
    const Image = 'Image' in ui ? ui.Image : undefined
    const live = isLive(mission)
    const done = isComplete(mission)
    const rule = '─'.repeat(cols)

    // Masthead
    const word = spaced('AGENT DOCK')
    const letters = word.split('').map((char, i) => (
      <Text bold color={blend(CORAL, GOLD, i / Math.max(1, word.length - 1))}>
        {char}
      </Text>
    ))
    const state = live ? (
      <Text bold color={tick % 4 < 2 ? GREEN : blend(GREEN, '#202024', 0.55)}>
        ● {spaced('LIVE')}
      </Text>
    ) : done ? (
      <Text bold color={GREEN}>
        {spaced('COMPLETE')}
      </Text>
    ) : (
      <Text dimColor>{spaced('STANDING BY')}</Text>
    )

    // Team size
    const chip = (size: number) => {
      const isPicked = settings.size === size
      return (
        <Button key={`dock-size-${size}`} plain onPress={() => void chooseSize($, size)}>
          {isPicked ? (
            <Text bold backgroundColor={CORAL} color="#1A1A1E">
              {` ${size} `}
            </Text>
          ) : (
            <Text dimColor>{` ${size} `}</Text>
          )}
        </Button>
      )
    }
    const isCustomSize = !(SIZES as readonly number[]).includes(settings.size)
    const custom = (
      <Button key="dock-size-custom" plain onPress={() => void setSettings($, s => ({ ...s, isCustomOpen: !s.isCustomOpen }))}>
        {isCustomSize ? (
          <Text bold backgroundColor={CORAL} color="#1A1A1E">{` ${settings.size} `}</Text>
        ) : (
          <Text dimColor> Custom </Text>
        )}
      </Button>
    )

    const modelChip = (model: DockHelperModel, label: string) => (
      <Button key={`dock-model-${model}`} plain onPress={() => void chooseModel($, model)}>
        {settings.helperModel === model ? (
          <Text bold color={CORAL}>{`● ${label}`}</Text>
        ) : (
          <Text dimColor>{`○ ${label}`}</Text>
        )}
      </Button>
    )

    const header = (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between">
          <Box flexDirection="row">
            <Text color={CORAL}>◆  </Text>
            {letters}
          </Box>
          {state}
        </Box>
        <Text color={HAIRLINE}>{rule}</Text>
        <Box flexDirection="row" alignItems="center" flexWrap="wrap">
          <Text dimColor>{spaced('TEAM')}  {spaced('SIZE')}  </Text>
          <Box flexDirection="row" borderStyle="round" borderColor={HAIRLINE} paddingX={1}>
            {SIZES.map(chip)}
            <Text color={HAIRLINE}> │</Text>
            {custom}
          </Box>
        </Box>
        <Text dimColor wrap="truncate-end">
          {infoLine(settings.size, await concurrency($), settings.helperModel)}
        </Text>
        <Box flexDirection="row">
          <Text dimColor>Helper agents:  </Text>
          {modelChip('fast', 'Fast & Cheap')}
          <Text> </Text>
          {modelChip('same', 'Same as me')}
        </Box>
        {settings.isCustomOpen && Input !== undefined && (
          <Input
            key="dock-custom-size"
            label="How many helpers?"
            placeholder="1 to 100"
            autoFocus
            onSubmit={value => {
              const size = parseSize(value)
              if (size === null) {
                $.ui.toast(BAD_NUMBER)
                return
              }
              void chooseSize($, size)
            }}
          />
        )}
        {settings.pendingSize !== null && (
          <Box flexDirection="column" borderStyle="round" borderColor={GOLD} paddingX={1}>
            <Text color={GOLD}>Big team: this uses your plan quickly. Continue?</Text>
            <Box flexDirection="row">
              <Button key="dock-big-continue" variant="primary" label={`Continue with ${settings.pendingSize}`} onPress={() => void confirmSize($)} />
              <Text> </Text>
              <Button key="dock-big-cancel" label="Cancel" onPress={() => void setSettings($, s => ({ ...s, pendingSize: null }))} />
            </Box>
          </Box>
        )}
      </Box>
    )

    // Idle: the team's seats, waiting.
    if (mission === null || mission.helpers.length === 0) {
      const step = Math.floor(now / 1500)
      const seats = Array.from({ length: Math.min(settings.size, 25) }, (_, i) => (
        <Text color={faceColor(i)} dimColor={!seatGlows(i, step)}>
          {'● '}
        </Text>
      ))
      return (
        <Box flexDirection="column">
          {header}
          <Text> </Text>
          <Box flexDirection="row" flexWrap="wrap">{seats}</Box>
          <Text> </Text>
          <Text bold>Your team of {settings.size} is standing by</Text>
          <Text dimColor>
            {settings.size === 1
              ? 'Send a request and Claude decides how many helpers to use.'
              : `Send a request and it splits across ${settings.size} helpers.`}
          </Text>
        </Box>
      )
    }

    // Mission bar
    const c = counts(mission.helpers)
    const elapsed = (mission.finishedAt ?? now) - mission.startedAt
    const barWidth = cols
    const seg = missionSegments(mission, barWidth)
    const sweepChunks = Math.max(1, Math.min(10, seg.done))
    const sweep = Array.from({ length: sweepChunks }, (_, i) => {
      const from = Math.floor((i * seg.done) / sweepChunks)
      const to = Math.floor(((i + 1) * seg.done) / sweepChunks)
      return <Text color={blend(CORAL, GOLD, i / Math.max(1, sweepChunks - 1))}>{'━'.repeat(to - from)}</Text>
    })
    const shimmerAt = seg.working > 0 ? tick % seg.working : -1
    const working = seg.working > 0 && (
      <Text>
        <Text color={GREEN}>{'━'.repeat(Math.max(0, shimmerAt))}</Text>
        <Text color={blend(GREEN, '#FFFFFF', 0.5)}>━</Text>
        <Text color={GREEN}>{'━'.repeat(Math.max(0, seg.working - shimmerAt - 1))}</Text>
      </Text>
    )

    const missionBlock = (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between">
          <Box flexDirection="row" flexShrink={1}>
            <Text dimColor>{spaced('MISSION')}   </Text>
            <Text bold wrap="truncate-end">{mission.job}</Text>
          </Box>
          <Text>
            <Text bold>{missionPercent(mission)}%</Text>
            <Text dimColor>{'   '}{clock(elapsed)}</Text>
          </Text>
        </Box>
        <Box flexDirection="row">
          {sweep}
          {working}
          <Text color={HAIRLINE}>{'─'.repeat(seg.rest)}</Text>
        </Box>
        <Text>
          <Text color={GREEN}>● {c.working} working</Text>
          <Text dimColor>{'    '}○ {c.queued} queued</Text>
          <Text color={GOLD}>{'    '}✓ {c.done} done</Text>
          <Text color={c.stuck > 0 ? RED : undefined} dimColor={c.stuck === 0}>{'    '}✕ {c.stuck} stuck</Text>
        </Text>
      </Box>
    )

    const finale = done && (
      <Box borderStyle="round" borderColor={GREEN} paddingX={1}>
        <Text color={GREEN} wrap="truncate-end">✓ {summary(mission)}</Text>
      </Box>
    )

    // Cards, or tiles for a big team
    const isTiles = mission.helpers.length >= TILE_FROM
    const perRow = isTiles ? tilesPerRow(cols) : cardsPerRow(cols)
    const cardWidth = isTiles ? TILE_WIDTH - 1 : Math.floor((cols - (perRow - 1)) / perRow)

    const face = (helper: DockHelper) =>
      showImages && Image !== undefined ? (
        <Image
          source={{ file: `${$.plugin.root}/employee-headshots/${faceFile(helper.face)}`, format: 'png' }}
          columns={4}
          rows={2}
          alt={initials(helper.name)}
        />
      ) : (
        <Text bold backgroundColor={faceColor(helper.face)} color="#1A1A1E">
          {` ${initials(helper.name)} `}
        </Text>
      )

    const card = (helper: DockHelper) => {
      const isQueued = helper.status === 'queued'
      const border = helper.status === 'stuck' ? RED : HAIRLINE
      const took = helper.startedAt === null ? 0 : (helper.finishedAt ?? now) - helper.startedAt
      const meterWidth = Math.max(4, cardWidth - 4 - 6 - 6)
      const { filled, sweepAt } = meter(helper, meterWidth, tick)
      const color = helper.status === 'done' ? GOLD : helper.status === 'stuck' ? RED : GREEN
      const label =
        helper.status === 'done' ? '100%' : helper.status === 'stuck' ? 'stuck' : helper.hasReported ? `${helper.percent}%` : isQueued ? 'queued' : '···'
      const cells =
        sweepAt === null ? (
          <Text>
            <Text color={color}>{'━'.repeat(filled)}</Text>
            <Text color={HAIRLINE}>{'━'.repeat(meterWidth - filled)}</Text>
          </Text>
        ) : (
          <Text>
            {Array.from({ length: meterWidth }, (_, i) => (
              <Text color={i >= sweepAt && i < sweepAt + 3 ? GREEN : HAIRLINE}>━</Text>
            ))}
          </Text>
        )

      return (
        <Box
          key={`dock-card-${helper.id}`}
          width={cardWidth}
          borderStyle="round"
          borderColor={border}
          hover={{ borderColor: CORAL }}
          flexDirection="row"
          paddingX={1}
        >
          {face(helper)}
          <Box flexDirection="column" flexGrow={1} marginLeft={1}>
            <Box flexDirection="row" justifyContent="space-between">
              <Text bold={!isQueued} dimColor={isQueued} wrap="truncate-end">
                {helper.name}
              </Text>
              <Text dimColor>{' '}{clock(took)}</Text>
            </Box>
            <Box flexDirection="row" justifyContent="space-between">
              {cells}
              <Text dimColor={isQueued}>{' '}{label.padStart(5)}</Text>
            </Box>
          </Box>
        </Box>
      )
    }

    const tile = (helper: DockHelper) => {
      const mark =
        helper.status === 'done'
          ? '✓'
          : helper.status === 'stuck'
            ? '✕'
            : helper.status === 'queued'
              ? '○'
              : helper.hasReported
                ? `${helper.percent}%`
                : ['·  ', '·· ', '···'][tick % 3]!
      const markColor = helper.status === 'done' ? GOLD : helper.status === 'stuck' ? RED : helper.status === 'working' ? GREEN : undefined

      return (
        <Box
          key={`dock-tile-${helper.id}`}
          width={cardWidth}
          borderStyle="round"
          borderColor={helper.status === 'stuck' ? RED : HAIRLINE}
          hover={{ borderColor: CORAL }}
          flexDirection="row"
        >
          <Text bold color={faceColor(helper.face)} dimColor={helper.status === 'queued'}>
            {initials(helper.name)}
          </Text>
          <Text color={markColor} dimColor={helper.status === 'queued'}>
            {' '}{mark}
          </Text>
        </Box>
      )
    }

    const rows: DockHelper[][] = []
    for (let i = 0; i < mission.helpers.length; i += perRow) {
      rows.push(mission.helpers.slice(i, i + perRow))
    }

    return (
      <Box flexDirection="column">
        {header}
        <Text> </Text>
        {missionBlock}
        {finale}
        <Text> </Text>
        {rows.map((row, i) => (
          <Box key={`dock-row-${i}`} flexDirection="row" columnGap={1}>
            {row.map(isTiles ? tile : card)}
          </Box>
        ))}
      </Box>
    )
  })
}

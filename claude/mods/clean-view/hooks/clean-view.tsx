import { atom, read, update } from 'claude-code'
import type { EngineInterface, On, Timer } from 'claude-code'

import type { CleanViewChecklist, CleanViewTask } from '../types'

type $ = EngineInterface

const enabledAtom = atom({ plugin: 'clean-view', key: 'cleanViewEnabled' } as const, true)
const checklistAtom = atom({ plugin: 'clean-view', key: 'checklist' } as const, null)
const tickAtom = atom({ plugin: 'clean-view', key: 'tick' } as const, 0)

const PLAN_TOOL = 'mcp__clean-view__plan_steps'
const REPORT_TOOL = 'mcp__clean-view__report_progress'
const ALWAYS_ALLOWED = new Set([
  'ToolSearch',
  'TodoWrite',
  'TaskCreate',
  'TaskUpdate',
  'AskUserQuestion',
  PLAN_TOOL,
  REPORT_TOOL,
])

const MAX_NAME = 40
const METER = 10
const LABEL = 7
const TOGGLE_KEY = 'clean-view-toggle'

const ASK_OK = 'Claude needs your OK to continue'
const ASK_QUESTION = 'Claude has a question for you'
const WAITING = 'Claude is waiting for your reply'
const SAID_NO = 'you said no to a step, so Claude paused'
const KEEPS_FAILING = 'a step keeps failing, Claude is trying another way'
const REFUSED = "Claude couldn't help with that request"

const GUIDE = `# Clean View checklist

The person sees a simple checklist of your work above the prompt. Keep it true:
- For every request, even a quick question, call \`${PLAN_TOOL}\` first with 2 to 8 short step names in order. If it is deferred, load it with ToolSearch first. Other tools are refused until a plan exists.
- Write every step name in plain English a non-technical person understands. Keep it under 40 characters and start it with a verb, like "Build the pricing section".
- Never put file paths, file names, commands, code or tool names in a step name.
- Call \`${REPORT_TOOL}\` with the step's name and a percent as real progress happens, and with 100 the moment a step finishes.
- If this session has TodoWrite or TaskCreate, you may use your to-do list as the plan instead; its items follow the same naming rules.`

const CODE_FILE =
  /\.(tsx?|jsx?|mjs|cjs|mts|cts|py|rb|go|rs|java|kt|swift|c|cc|cpp|h|hpp|cs|php|sh|zsh|bash|json|ya?ml|toml|md|mdx|html?|css|scss|less|sql|xml|lock|env|ini|cfg|vue|svelte|dart|lua|pl|r)\b/i

/** Turns any step or job name into short, plain words a person can read. */
export function cleanName(raw: unknown): string {
  const words = String(raw ?? '')
    .replace(/`[^`]*`?/g, ' ')
    .split(/\s+/)
    .filter(word => word !== '' && !/[/\\]/.test(word) && !CODE_FILE.test(word))
  let name = words.join(' ').replace(/[\s,;:(\-–—]+$/, '').trim()

  if (name === '') {
    return 'Working on it'
  }

  name = name.charAt(0).toUpperCase() + name.slice(1)
  if (name.length <= MAX_NAME) {
    return name
  }

  let cut = name.slice(0, MAX_NAME - 1)
  const lastSpace = cut.lastIndexOf(' ')
  if (lastSpace > 10) {
    cut = cut.slice(0, lastSpace)
  }

  return cut.replace(/[\s,;:.\-–—]+$/, '') + '…'
}

/** A 2 to 6 word job title from the model's reply, or undefined. */
function cleanTitle(raw: string): string | undefined {
  const line = raw.split('\n').find(one => one.trim() !== '') ?? ''
  const words = line
    .replace(/["'`*_#.!?:]+/g, ' ')
    .split(/\s+/)
    .filter(word => word !== '')
    .slice(0, 6)

  return words.length === 0 ? undefined : cleanName(words.join(' '))
}

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

let idCount = 0
function makeTask(name: string, status: CleanViewTask['status']): CleanViewTask {
  idCount += 1

  return {
    id: `step-${idCount}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    status,
    percent: 0,
    hasReported: false,
  }
}

const finish = (task: CleanViewTask): CleanViewTask => ({
  ...task,
  status: 'done',
  percent: 100,
  hasReported: true,
})

/** With no step under way, the first one still to do starts. */
function startNextIfIdle(tasks: CleanViewTask[]): CleanViewTask[] {
  if (tasks.some(task => task.status === 'active')) {
    return tasks
  }
  const next = tasks.findIndex(task => task.status === 'upcoming')

  return next < 0 ? tasks : tasks.map((task, i) => (i === next ? { ...task, status: 'active' } : task))
}

function newJob(startedAt: number): CleanViewChecklist {
  return {
    title: 'Working on your request',
    phase: 'working',
    tasks: [makeTask('Understand your request', 'active'), makeTask('Plan the steps', 'upcoming')],
    hasPlan: false,
    needsYouReason: null,
    stuckReason: null,
    startedAt,
    finishedAt: null,
    isCollapsed: false,
  }
}

const isLive = (list: CleanViewChecklist) =>
  list.phase === 'working' || list.phase === 'needs-you' || list.phase === 'stuck'

const hasUnfinished = (list: CleanViewChecklist) => list.tasks.some(task => task.status !== 'done')

export function applyPlan(list: CleanViewChecklist, steps: string[]): CleanViewChecklist {
  const names: string[] = []
  for (const step of steps.map(cleanName)) {
    if (!names.some(name => sameName(name, step))) {
      names.push(step)
    }
  }

  return {
    ...list,
    hasPlan: true,
    tasks: names.slice(0, 8).map((name, i) => makeTask(name, i === 0 ? 'active' : 'upcoming')),
  }
}

export function applyProgress(list: CleanViewChecklist, rawName: string, percent: number): CleanViewChecklist {
  const name = cleanName(rawName)
  let tasks = list.hasPlan ? [...list.tasks] : []
  let at = tasks.findIndex(task => sameName(task.name, name))

  if (at < 0) {
    // A step that is not in the plan becomes the current one, ahead of the rest.
    const firstOpen = tasks.findIndex(task => task.status !== 'done')
    at = firstOpen < 0 ? tasks.length : firstOpen
    tasks.splice(at, 0, makeTask(name, 'active'))
  }

  tasks = tasks.map((task, i) => {
    if (i < at) {
      return finish(task)
    }
    if (i === at) {
      return { ...task, status: 'active', percent, hasReported: true }
    }

    return task.status === 'done' ? task : { ...task, status: 'upcoming' }
  })

  const current = tasks[at]
  if (percent >= 100 && current !== undefined) {
    tasks[at] = finish(current)
    const next = tasks.findIndex((task, i) => i > at && task.status !== 'done')
    const following = tasks[next]
    if (following !== undefined) {
      tasks[next] = { ...following, status: 'active' }
    }
  }

  return { ...list, hasPlan: true, tasks }
}

type Todo = { content: string; status: 'pending' | 'in_progress' | 'completed' }

export function applyTodos(list: CleanViewChecklist, todos: readonly Todo[]): CleanViewChecklist {
  const before = list.hasPlan ? list.tasks : []
  const tasks = todos.map(todo => {
    const name = cleanName(todo.content)
    const known = before.find(task => sameName(task.name, name))
    const base = known ?? makeTask(name, 'upcoming')

    if (todo.status === 'completed') {
      return finish(base)
    }

    return { ...base, status: todo.status === 'in_progress' ? 'active' : 'upcoming' } as CleanViewTask
  })

  return { ...list, hasPlan: true, tasks: startNextIfIdle(tasks) }
}

/** One calm sentence for an API error, from its kind and whatever it said. */
export function describeApiError(kind: string, details = ''): string {
  const said = `${kind} ${details}`

  if (/rate_limit|billing|usage limit|rate limit|quota/i.test(said)) {
    return 'you hit your usage limit, try again a little later'
  }
  if (/overloaded|server_error|529|busy/i.test(said)) {
    return "Claude's servers are busy, try again in a minute"
  }
  if (/too long|context|max_output_tokens|prompt is too/i.test(said)) {
    return 'the conversation got too long, type /compact and try again'
  }
  if (/network|connect|ECONN|ETIMEDOUT|ENOTFOUND|fetch failed|socket|offline|timed out/i.test(said)) {
    return 'the internet connection dropped'
  }
  if (/auth|oauth|login|401|403|credential/i.test(said)) {
    return 'Claude is signed out, type /login'
  }

  return 'something went wrong on Claude’s side, try again'
}

const USER_SAID_NO =
  /user doesn't want to proceed|tool use was rejected|user (denied|rejected|declined)|permission (was )?denied by the user/i

function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(seconds / 60)

  return minutes === 0 ? `${seconds}s` : `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`
}

function fit(text: string, width: number): string {
  if (width <= 1) {
    return text.slice(0, Math.max(0, width))
  }

  return text.length <= width ? text : text.slice(0, width - 1) + '…'
}

function meter(task: CleanViewTask, tick: number, isMoving: boolean): string {
  if (task.status === 'done') {
    return '█'.repeat(METER)
  }
  if (task.status === 'upcoming') {
    return '░'.repeat(METER)
  }
  if (task.hasReported) {
    const filled = Math.round(task.percent / 10)

    return '█'.repeat(filled) + '░'.repeat(METER - filled)
  }

  // No percent yet: a short block sweeps across the meter.
  const from = isMoving ? (tick % (METER + 3)) - 2 : -10
  let cells = ''
  for (let i = 0; i < METER; i += 1) {
    cells += i >= from && i < from + 3 ? '▓' : '░'
  }

  return cells
}

// These start over on a reload; the checklist itself lives in $.state.
let ticker: Timer | undefined
let failuresInARow = 0
let lastSubmitWasCommand = false
let apiFailure: string | undefined

async function syncClock($: $) {
  const isEnabled = await read($, enabledAtom)
  const list = await read($, checklistAtom)
  const isAnimating =
    isEnabled && list !== null && (list.phase === 'working' || list.phase === 'needs-you')

  if (isAnimating && ticker === undefined) {
    ticker = $.clock.every(250, () => void update($, tickAtom, n => ((n ?? 0) + 1) % 1_000_000))
  } else if (!isAnimating && ticker !== undefined) {
    ticker.cancel()
    ticker = undefined
  }
}

async function setChecklist($: $, fn: (list: CleanViewChecklist | null) => CleanViewChecklist | null) {
  await update($, checklistAtom, list => fn(list ?? null))
  await syncClock($)
}

async function setEnabled($: $, want: boolean | undefined, isToasting: boolean): Promise<boolean> {
  await update($, enabledAtom, was => (want === undefined ? !(was ?? true) : want))
  const isEnabled = await read($, enabledAtom)
  await $.store.set('cleanViewEnabled', isEnabled)
  await syncClock($)
  if (isToasting) {
    $.ui.toast(isEnabled ? 'Clean View is on' : 'Clean View is off')
  }

  return isEnabled
}

async function nameJob($: $, prompt: string, startedAt: number) {
  const reply = await $.model.complete({
    model: 'haiku',
    effort: 'low',
    maxTokens: 30,
    timeoutMs: 20_000,
    system:
      'Name the job in the request in 2 to 6 plain words a non-technical person understands. Start with a verb. No file names, code or punctuation. Reply with the name only.',
    prompt: prompt.slice(0, 4000),
  })
  const title = reply.isAnswered ? cleanTitle(reply.text) : undefined
  if (title === undefined) {
    return
  }

  // A newer job may have started meanwhile: its own name wins.
  await setChecklist($, list => (list !== null && list.startedAt === startedAt ? { ...list, title } : list))
}

async function needsYou($: $, reason: string) {
  await setChecklist($, list =>
    list !== null && isLive(list) ? { ...list, phase: 'needs-you', needsYouReason: reason } : list,
  )
}

async function backToWork($: $) {
  await setChecklist($, list =>
    list !== null && list.phase === 'needs-you'
      ? { ...list, phase: 'working', needsYouReason: null }
      : list,
  )
}

async function stuck($: $, reason: string) {
  await setChecklist($, list =>
    list !== null && isLive(list) ? { ...list, phase: 'stuck', stuckReason: reason, needsYouReason: null } : list,
  )
}

export function registerCleanView(on: On) {
  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: 'plan_steps',
      description:
        'Lay out every step of the job up front, 2 to 8 short plain-English names in order, each starting with a verb. The first step starts right away. Call this first for every request.',
      inputSchema: {
        type: 'object',
        properties: {
          steps: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 8 },
        },
        required: ['steps'],
      },
      isDeferred: false,
    })
    await $.tool.register({
      name: 'report_progress',
      description:
        'Report progress on the current step by its name, 0 to 100. Report 100 the moment a step finishes; the next step then starts.',
      inputSchema: {
        type: 'object',
        properties: { task: { type: 'string' }, percent: { type: 'number' } },
        required: ['task', 'percent'],
      },
      isDeferred: false,
    })
    await $.command.register({
      name: 'simple',
      description: 'Turn Clean View on or off',
      argumentHint: 'on|off',
    })

    const saved = await $.store.get('cleanViewEnabled')
    await update($, enabledAtom, () => (typeof saved === 'boolean' ? saved : true))
    await syncClock($)

    return next(e)
  })

  on('command.run', { command: 'simple' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg !== '' && arg !== 'on' && arg !== 'off') {
      return { text: 'Type /simple on, /simple off, or just /simple to switch.' }
    }
    const isEnabled = await setEnabled($, arg === '' ? undefined : arg === 'on', false)

    return { text: isEnabled ? 'Clean View is on.' : 'Clean View is off.' }
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    if (!(await read($, enabledAtom))) {
      return composed
    }

    return {
      sections: [...composed.sections, { id: 'clean-view:steps', text: GUIDE, scope: 'session' }],
    }
  })

  on('prompt.submit', ($, e, next) => {
    lastSubmitWasCommand = e.command !== undefined

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId !== undefined) {
      return next(e)
    }

    const text = e.text.trim()
    const isRealPrompt = text !== '' && !text.startsWith('/') && !lastSubmitWasCommand
    lastSubmitWasCommand = false
    const list = await read($, checklistAtom)
    const isContinuing = list !== null && isLive(list) && hasUnfinished(list)

    if (isRealPrompt && !isContinuing) {
      const startedAt = await $.clock.now()
      failuresInARow = 0
      apiFailure = undefined
      await setChecklist($, () => newJob(startedAt))
      $.clock.after(0, () => void nameJob($, text, startedAt).catch(() => undefined))
    } else if (isContinuing) {
      await setChecklist($, one =>
        one === null ? one : { ...one, phase: 'working', needsYouReason: null, stuckReason: null },
      )
    }

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const tool = String(e.tool)
    const input = e as unknown as Record<string, unknown>

    if (tool === PLAN_TOOL || tool === REPORT_TOOL) {
      if (e.agentId !== undefined) {
        return { result: 'Noted.' }
      }
      const startedAt = await $.clock.now()

      if (tool === PLAN_TOOL) {
        const steps = Array.isArray(input.steps) ? input.steps.map(String) : []
        if (steps.length === 0) {
          return { deny: 'plan_steps needs 2 to 8 short step names.' }
        }
        await setChecklist($, list => applyPlan(list ?? newJob(startedAt), steps))
        const list = await read($, checklistAtom)
        const count = list?.tasks.length ?? steps.length

        return { result: `Planned ${count} steps. The first one has started.` }
      }

      const raw = Number(input.percent)
      const percent = Math.round(Math.min(100, Math.max(0, Number.isFinite(raw) ? raw : 0)))
      await setChecklist($, list => applyProgress(list ?? newJob(startedAt), String(input.task ?? ''), percent))

      return { result: `Progress noted: ${percent}%.` }
    }

    if (e.agentId !== undefined) {
      return next(e)
    }

    const isEnabled = await read($, enabledAtom)
    const list = await read($, checklistAtom)
    if (isEnabled && list !== null && isLive(list) && !list.hasPlan && !ALWAYS_ALLOWED.has(tool)) {
      return {
        deny: `Clean View: call ${PLAN_TOOL} first to lay out the steps in plain English (load it with ToolSearch if it is deferred), then try again.`,
      }
    }

    // The next tool running means the person has answered.
    await backToWork($)
    if (e.tool === 'TodoWrite') {
      const todos = e.todos
      await setChecklist($, one => (one === null ? one : applyTodos(one, todos)))
    }
    if (tool === 'AskUserQuestion') {
      await needsYou($, ASK_QUESTION)
    }

    const ran = await next(e)
    await backToWork($)

    if (e.tool === 'TaskCreate' && ran.isError !== true && ran.deny === undefined) {
      const created = (ran.result as { task?: { id?: string } } | undefined)?.task?.id
      const name = cleanName(e.subject)
      await setChecklist($, one => {
        if (one === null) {
          return one
        }
        const tasks = [...(one.hasPlan ? one.tasks : []), { ...makeTask(name, 'upcoming'), id: `task-${created ?? idCount}` }]

        return { ...one, hasPlan: true, tasks: startNextIfIdle(tasks) }
      })
    }
    if (e.tool === 'TaskUpdate' && ran.isError !== true && ran.deny === undefined) {
      const { taskId, status, subject } = e
      await setChecklist($, one => {
        if (one === null) {
          return one
        }
        let tasks = one.tasks
          .filter(task => !(task.id === `task-${taskId}` && status === 'deleted'))
          .map(task => {
            if (task.id !== `task-${taskId}`) {
              return task
            }
            const renamed = subject === undefined ? task : { ...task, name: cleanName(subject) }
            if (status === 'completed') {
              return finish(renamed)
            }
            if (status === 'in_progress') {
              return { ...renamed, status: 'active' } as CleanViewTask
            }
            if (status === 'pending') {
              return { ...renamed, status: 'upcoming' } as CleanViewTask
            }

            return renamed
          })
        tasks = startNextIfIdle(tasks)

        return { ...one, tasks }
      })
    }

    const said = ran.deny ?? (ran.isError === true ? ran.text : undefined)
    if (said !== undefined && USER_SAID_NO.test(said)) {
      failuresInARow = 0
      await stuck($, SAID_NO)
    } else if (ran.isError === true) {
      failuresInARow += 1
      if (failuresInARow >= 3) {
        await stuck($, KEEPS_FAILING)
      }
    } else if (ran.deny === undefined) {
      failuresInARow = 0
      await setChecklist($, one =>
        one !== null && one.phase === 'stuck' ? { ...one, phase: 'working', stuckReason: null } : one,
      )
    }

    return ran
  })

  on('classic.Notification', async ($, e, next) => {
    if (e.notification_type === 'permission_prompt') {
      await needsYou($, ASK_OK)
    } else if (e.notification_type === 'elicitation_dialog') {
      await needsYou($, ASK_QUESTION)
    }

    return next(e)
  })

  on('classic.PermissionRequest', async ($, e, next) => {
    await needsYou($, ASK_OK)

    return next(e)
  })

  on('classic.StopFailure', async ($, e, next) => {
    apiFailure = describeApiError(e.error, e.error_details ?? '')
    await stuck($, apiFailure)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId !== undefined) {
      return ran
    }

    const finishedAt = await $.clock.now()
    const failure = apiFailure
    apiFailure = undefined
    let isAllDone = false

    await setChecklist($, list => {
      if (list === null || !isLive(list)) {
        return list
      }
      if (e.reason === 'error') {
        return { ...list, phase: 'stuck', needsYouReason: null, stuckReason: failure ?? describeApiError('unknown', e.answer) }
      }
      if (e.reason === 'refusal') {
        return { ...list, phase: 'stuck', needsYouReason: null, stuckReason: REFUSED }
      }
      if (e.reason === 'aborted') {
        return { ...list, phase: 'stopped', needsYouReason: null, finishedAt }
      }
      if (list.hasPlan && hasUnfinished(list)) {
        return list.phase === 'stuck'
          ? list
          : { ...list, phase: 'needs-you', needsYouReason: WAITING }
      }

      isAllDone = true

      return {
        ...list,
        phase: 'done',
        needsYouReason: null,
        stuckReason: null,
        finishedAt,
        tasks: list.tasks.map(finish),
      }
    })

    if (isAllDone) {
      $.clock.after(5000, () =>
        void setChecklist($, list =>
          list !== null && list.phase === 'done' && list.finishedAt === finishedAt
            ? { ...list, isCollapsed: true }
            : list,
        ),
      )
    }

    return ran
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    const isEnabled = await read($, enabledAtom)
    const list = await read($, checklistAtom)
    const cols = Math.max(24, e.props.bodyColumns)

    const toggle = (
      <Button
        key={TOGGLE_KEY}
        label={isEnabled ? '● Clean View: ON' : '○ Clean View: OFF'}
        variant={isEnabled ? 'primary' : undefined}
        onPress={() => void setEnabled($, undefined, true)}
      />
    )

    if (!isEnabled || list === null) {
      return (
        <Box flexDirection="row" justifyContent="flex-end">
          {toggle}
        </Box>
      )
    }

    const tick = (await read($, tickAtom)) ?? 0
    const now = await $.clock.now()
    const room = Math.max(8, cols - 22)
    const took = formatDuration((list.finishedAt ?? now) - list.startedAt)

    let header
    if (list.phase === 'needs-you') {
      header = (
        <Box flexDirection="row">
          <Text backgroundColor="warning" color="inverseText" bold>
            {' Needs you '}
          </Text>
          <Text wrap="truncate-end"> {fit(list.needsYouReason ?? WAITING, room - 12)}</Text>
        </Box>
      )
    } else if (list.phase === 'stuck') {
      header = (
        <Text color="warning" wrap="truncate-end">
          {fit(`⚠ Stuck: ${list.stuckReason ?? KEEPS_FAILING}`, room)}
        </Text>
      )
    } else if (list.phase === 'stopped') {
      header = (
        <Text dimColor wrap="truncate-end">
          {fit(`■ Stopped · ${list.title} · you pressed Esc`, room)}
        </Text>
      )
    } else if (list.phase === 'done') {
      header = (
        <Text color="success" wrap="truncate-end">
          {fit(`✓ All done · ${list.title} · took ${took}`, room)}
        </Text>
      )
    } else {
      header = (
        <Text bold wrap="truncate-end">
          {fit(`${list.title} · ${took}`, room)}
        </Text>
      )
    }

    const headerRow = (
      <Box flexDirection="row" justifyContent="space-between">
        <Box flexShrink={1}>{header}</Box>
        {toggle}
      </Box>
    )

    if (list.phase === 'done' && list.isCollapsed) {
      return headerRow
    }

    const nameWidth = Math.max(6, cols - 2 - 1 - METER - 2 - LABEL)
    const firstUpcoming = list.tasks.findIndex(task => task.status === 'upcoming')
    const isMoving = list.phase === 'working'

    return (
      <Box flexDirection="column">
        {headerRow}
        {list.tasks.map((task, i) => {
          const icon =
            task.status === 'done' ? '✓' : task.status === 'active' ? (list.phase === 'needs-you' ? '‖' : '▶') : '○'
          const label =
            task.status === 'done'
              ? 'Done'
              : task.status === 'active'
                ? task.hasReported
                  ? `${task.percent}%`
                  : 'Working'
                : i === firstUpcoming
                  ? 'Next'
                  : 'Up next'

          return (
            <Box key={task.id} flexDirection="row">
              <Text color={task.status === 'done' ? 'success' : task.status === 'active' ? 'claude' : undefined} dimColor={task.status === 'upcoming'}>
                {icon}{' '}
              </Text>
              <Text bold={task.status === 'active'} dimColor={task.status !== 'active'} wrap="truncate-end">
                {fit(task.name, nameWidth).padEnd(nameWidth)}
              </Text>
              <Text color={task.status === 'done' ? 'success' : task.status === 'active' ? 'claude' : undefined} dimColor={task.status === 'upcoming'}>
                {' '}{meter(task, tick, isMoving)}
              </Text>
              <Text dimColor={task.status !== 'active'}>{'  '}{label}</Text>
            </Box>
          )
        })}
      </Box>
    )
  })
}

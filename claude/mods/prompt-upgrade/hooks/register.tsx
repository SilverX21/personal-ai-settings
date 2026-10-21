import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Answer, Flow, HistoryEntry, Question, Step } from '../types'
import {
  QUESTIONS_SYSTEM,
  REWRITE_SYSTEM,
  ago,
  bigNumber,
  countWords,
  decideIntercept,
  fit,
  parseQuestions,
  parseRewrite,
  questionsPrompt,
  rewritePrompt,
} from './logic'

type Engine = EngineInterface

const PANE = 'prompt-upgrade'
const TITLE = 'Prompt Upgrade'
const QUESTION_MODEL = 'haiku'
const REWRITE_MODEL = 'sonnet'
const HISTORY_LIMIT = 20

const GOLD = '#F2C46D'
const LINE = '#262B33'
const MUTED = '#7D8590'
const TEXT = '#E6EDF3'
const GREEN = '#3DD68C'
const AMBER = '#E3B341'
const INK = '#0D1117'

const flowAtom = atom({ plugin: 'prompt-upgrade', key: 'flow' } as const, null)
const historyAtom = atom({ plugin: 'prompt-upgrade', key: 'history' } as const, [])
const autoAtom = atom({ plugin: 'prompt-upgrade', key: 'auto' } as const, false)
const viewAtom = atom({ plugin: 'prompt-upgrade', key: 'view' } as const, 'flow')

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

function blankFlow(original: string, step: Step): Flow {
  return {
    id: newId(),
    original,
    step,
    questions: [],
    answers: {},
    otherOpen: null,
    upgraded: '',
    added: [],
    isEditing: false,
    failedStep: null,
    errorText: '',
    isCopied: false,
    callId: '',
  }
}

const patch = ($: Engine, id: string, fn: (flow: Flow) => Flow) =>
  update($, flowAtom, flow => (flow !== null && flow.id === id ? fn(flow) : flow))

const failReason = (err: unknown) => (err instanceof Error ? err.message : String(err))

async function openPane($: Engine, restore?: string): Promise<boolean> {
  const opened = await $.ui.open({ id: PANE, title: TITLE })
  if (opened.isPlaced) return true

  // Only when nothing can seat the pane: give the words back.
  await update($, flowAtom, () => null)
  if (restore !== undefined && restore.length > 0) {
    $.clock.after(50, () => void $.prompt.fill({ text: restore, mode: 'replace' }))
  }
  $.ui.toast('The window is too narrow for the Prompt Upgrade pane, so your words are back in the prompt box.')

  return false
}

async function runQuestions($: Engine, flowId: string): Promise<void> {
  const callId = newId()
  await patch($, flowId, flow => ({ ...flow, step: 'reading', failedStep: null, errorText: '', callId }))
  const flow = await read($, flowAtom)
  if (flow === null || flow.id !== flowId) return

  let questions: Question[] | undefined
  let reason = 'The reply could not be read.'
  try {
    const reply = await $.model.complete({
      model: QUESTION_MODEL,
      system: QUESTIONS_SYSTEM,
      prompt: questionsPrompt(flow.original),
      maxTokens: 800,
      effort: 'low',
      timeoutMs: 45000,
    })
    if (reply.isAnswered) questions = parseQuestions(reply.text)
    else reason = reply.reason === 'aborted' ? 'The model took too long.' : `The model call failed (${reply.reason}).`
  } catch (err) {
    reason = failReason(err)
  }

  const current = await read($, flowAtom)
  if (current === null || current.id !== flowId || current.callId !== callId) return

  if (questions === undefined) {
    await patch($, flowId, f => ({ ...f, step: 'error', failedStep: 'reading', errorText: reason }))
    return
  }
  if (questions.length === 0) {
    await patch($, flowId, f => ({ ...f, questions: [] }))
    await runRewrite($, flowId)
    return
  }
  await patch($, flowId, f => ({ ...f, step: 'questions', questions, answers: {}, otherOpen: null }))
}

async function runRewrite($: Engine, flowId: string): Promise<void> {
  const callId = newId()
  await patch($, flowId, flow => ({ ...flow, step: 'rewriting', otherOpen: null, failedStep: null, errorText: '', callId }))
  const flow = await read($, flowAtom)
  if (flow === null || flow.id !== flowId) return

  let result: { prompt: string; added: string[] } | undefined
  let reason = 'The reply could not be read.'
  try {
    const reply = await $.model.complete({
      model: REWRITE_MODEL,
      system: REWRITE_SYSTEM,
      prompt: rewritePrompt(flow.original, flow.questions, flow.answers),
      maxTokens: 3000,
      timeoutMs: 90000,
    })
    if (reply.isAnswered) result = parseRewrite(reply.text)
    else reason = reply.reason === 'aborted' ? 'The model took too long.' : `The model call failed (${reply.reason}).`
  } catch (err) {
    reason = failReason(err)
  }

  const current = await read($, flowAtom)
  if (current === null || current.id !== flowId || current.callId !== callId) return

  if (result === undefined) {
    await patch($, flowId, f => ({ ...f, step: 'error', failedStep: 'rewriting', errorText: reason }))
    return
  }
  const done = result
  await patch($, flowId, f => ({ ...f, step: 'review', upgraded: done.prompt, added: done.added, isEditing: false }))
  await remember($, { ...current, upgraded: done.prompt, added: done.added })
}

async function remember($: Engine, flow: Flow): Promise<void> {
  const entry: HistoryEntry = {
    id: flow.id,
    at: await $.clock.now(),
    original: flow.original,
    upgraded: flow.upgraded,
    added: flow.added,
    questions: flow.questions,
    answers: flow.answers,
  }
  await update($, historyAtom, list => [entry, ...list.filter(one => one.id !== entry.id)].slice(0, HISTORY_LIMIT))
  await $.store.set('history', await read($, historyAtom))
}

async function answer($: Engine, flowId: string, index: number, value: Answer): Promise<void> {
  await patch($, flowId, flow => ({
    ...flow,
    answers: { ...flow.answers, [String(index)]: value },
    otherOpen: null,
  }))
  const flow = await read($, flowAtom)
  if (flow === null || flow.id !== flowId || flow.step !== 'questions') return
  const isComplete = flow.questions.every((_, i) => flow.answers[String(i)] !== undefined)
  if (isComplete) await runRewrite($, flowId)
}

async function closeFlow($: Engine): Promise<Flow | null> {
  const flow = await read($, flowAtom)
  await update($, flowAtom, () => null)
  await update($, viewAtom, () => 'flow')
  await $.ui.close({ id: PANE })

  return flow
}

async function send($: Engine, text: string): Promise<void> {
  const flow = await read($, flowAtom)
  if (flow !== null && flow.step === 'review' && text !== flow.upgraded) {
    await remember($, { ...flow, upgraded: text })
  }
  await closeFlow($)
  await $.prompt.submit({ text, asUser: true })
}

async function cancel($: Engine): Promise<void> {
  const flow = await closeFlow($)
  if (flow !== null && flow.original.length > 0) {
    await $.prompt.fill({ text: flow.original, mode: 'replace' })
  }
}

async function setAuto($: Engine, isOn: boolean): Promise<void> {
  await update($, autoAtom, () => isOn)
  await $.store.set('auto', isOn)
}

function stepIndex(flow: Flow): number {
  switch (flow.step) {
    case 'compose':
    case 'reading':
      return 0
    case 'questions':
      return 1
    case 'rewriting':
      return 2
    case 'review':
      return 3
    case 'error':
      return flow.failedStep === 'rewriting' ? 2 : 0
  }
}

function asHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return []

  return value
    .filter(
      (one): one is HistoryEntry =>
        typeof one === 'object' && one !== null && typeof one.id === 'string' && typeof one.upgraded === 'string',
    )
    .slice(0, HISTORY_LIMIT)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({
        name: 'better',
        description: 'Upgrade a rough prompt in a pane before sending it',
        argumentHint: '<prompt> | on | off | history',
      })
      const storedHistory = await $.store.get('history')
      const storedAuto = await $.store.get('auto')
      await update($, historyAtom, () => asHistory(storedHistory))
      await update($, autoAtom, () => storedAuto === true)

      // A reload mid-step drops the old module's calls; pick the step back up.
      const flow = await read($, flowAtom)
      if (flow !== null) {
        void $.ui.open({ id: PANE, title: TITLE })
        if (flow.step === 'reading' && flow.original.length > 0) void runQuestions($, flow.id)
        if (flow.step === 'rewriting') void runRewrite($, flow.id)
      }
    } catch {
      // Starting the session matters more than this mod's setup.
    }

    return next(e)
  })

  on('command.run', { command: 'better' }, async ($, e) => {
    const arg = e.args.trim()
    const word = arg.toLowerCase()

    if (word === 'on' || word === 'off') {
      await setAuto($, word === 'on')

      return {
        text:
          word === 'on'
            ? 'Prompt Upgrade is on: prompts you type open in the pane first. Start one with ">" to send it as is.'
            : 'Prompt Upgrade is off: prompts go straight through.',
      }
    }
    if (word === 'history') {
      await update($, viewAtom, () => 'history')
      void openPane($)

      return { text: 'Showing your last upgrades in the Prompt Upgrade pane.' }
    }
    if (arg.length === 0) {
      await update($, flowAtom, () => blankFlow('', 'compose'))
      await update($, viewAtom, () => 'flow')
      void openPane($)

      return { text: 'Type your prompt in the Prompt Upgrade pane.' }
    }

    const flow = blankFlow(arg, 'reading')
    await update($, flowAtom, () => flow)
    await update($, viewAtom, () => 'flow')
    void openPane($, arg).then(isOpen => (isOpen ? runQuestions($, flow.id) : undefined))

    return { text: 'Upgrading your prompt in the Prompt Upgrade pane. Nothing is sent until you press Run.' }
  }).catch(() => ({ text: 'Prompt Upgrade hit a problem and did nothing. Your prompt is safe.' }))

  on('prompt.submit', async ($, e, next) => {
    const decision = decideIntercept({
      text: e.text,
      originKind: e.origin.kind,
      isAuto: await read($, autoAtom),
      hasCommand: e.command !== undefined,
      hasAttachments: (e.attachments?.length ?? 0) > 0,
      isBusy: e.turnId !== undefined,
      isMeta: e.isMeta === true,
    })
    if (decision.kind === 'pass') return next(e)
    if (decision.kind === 'strip') return next({ ...e, text: decision.text })

    const original = e.text.trim()
    const flow = blankFlow(original, 'reading')
    await update($, flowAtom, () => flow)
    await update($, viewAtom, () => 'flow')
    const isOpen = await openPane($, original)
    if (!isOpen) return { drop: 'Prompt Upgrade could not open its pane; your words are back in the prompt box.' }
    void runQuestions($, flow.id)

    return { drop: 'Prompt Upgrade: upgrading in the pane. Nothing was sent.' }
  }).catch(($, e, next) => next(e))

  on('ui.close', { id: PANE }, async ($, e, next) => {
    if (e.origin.kind === 'person') {
      const flow = await read($, flowAtom)
      await update($, flowAtom, () => null)
      await update($, viewAtom, () => 'flow')
      if (flow !== null && flow.original.length > 0) {
        await $.prompt.fill({ text: flow.original, mode: 'replace' })
      }
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const Input = 'Input' in ui ? ui.Input : undefined
    const cols = Math.max(20, e.props.bodyColumns)
    const flow = await read($, flowAtom)
    const view = await read($, viewAtom)
    const isAuto = await read($, autoAtom)

    const rule = (label: string) => (
      <Box flexDirection="row" marginTop={1}>
        <Text color={MUTED} bold>
          {label}
        </Text>
        <Text color={LINE}>{` ${'─'.repeat(Math.max(0, cols - label.length - 1))}`}</Text>
      </Box>
    )

    const gold = (key: string, label: string, onPress: () => unknown) => (
      <Button key={key} plain onPress={() => void onPress()}>
        <Text backgroundColor={GOLD} color={INK} bold>{` ${label} `}</Text>
      </Button>
    )
    const slate = (key: string, label: string, onPress: () => unknown, isDim = false) => (
      <Button key={key} plain onPress={() => void onPress()}>
        <Text backgroundColor={LINE} color={isDim ? MUTED : TEXT}>{` ${label} `}</Text>
      </Button>
    )
    const quiet = (key: string, label: string, onPress: () => unknown) => (
      <Button key={key} plain onPress={() => void onPress()}>
        <Text color={MUTED}>{label}</Text>
      </Button>
    )

    const title = 'PROMPT UPGRADE'
    const status = isAuto ? 'AUTO ON' : 'AUTO OFF'
    const header = (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between" width={cols}>
          <Text bold color={TEXT}>
            {title}
          </Text>
          {cols >= title.length + status.length + 2 && <Text color={isAuto ? GREEN : MUTED}>{status}</Text>}
        </Box>
        <Box flexDirection="row">
          <Text color={GOLD}>{'━'.repeat(Math.min(title.length, cols))}</Text>
          <Text color={LINE}>{'─'.repeat(Math.max(0, cols - title.length))}</Text>
        </Box>
      </Box>
    )

    const card = (key: string, label: string, body: string, width: number, border: string) => (
      <Box key={key} flexDirection="column" borderStyle="round" borderColor={border} paddingX={1} width={width}>
        <Text color={border === GOLD ? GOLD : MUTED} bold>
          {label}
        </Text>
        <Text color={TEXT}>{body.length > 0 ? body : ' '}</Text>
      </Box>
    )

    if (view === 'history') {
      const list = await read($, historyAtom)
      const now = await $.clock.now()

      return (
        <Box flexDirection="column" width={cols}>
          {header}
          {rule('LAST UPGRADES')}
          {list.length === 0 && <Text color={MUTED}>No upgrades yet. Try /better followed by a rough prompt.</Text>}
          {list.map(entry => {
            const age = ago(now - entry.at)

            return (
              <Button
                key={`h-${entry.id}`}
                plain
                onPress={async () => {
                  await update($, flowAtom, () => ({
                    ...blankFlow(entry.original, 'review'),
                    id: entry.id,
                    upgraded: entry.upgraded,
                    added: entry.added,
                    questions: entry.questions,
                    answers: entry.answers,
                  }))
                  await update($, viewAtom, () => 'flow')
                }}
              >
                <Text color={TEXT}>{fit(entry.original, cols - age.length - 3)}</Text>
                <Text color={MUTED}>{`  ${age}`}</Text>
              </Button>
            )
          })}
          <Box marginTop={1}>
            {quiet('history-close', flow !== null ? 'Back' : 'Close', async () =>
              flow !== null ? update($, viewAtom, () => 'flow') : closeFlow($),
            )}
          </Box>
        </Box>
      )
    }

    if (flow === null) {
      return (
        <Box flexDirection="column" width={cols}>
          {header}
          <Box marginTop={1}>
            <Text color={MUTED}>Nothing to upgrade. Type /better followed by a rough prompt.</Text>
          </Box>
          <Box marginTop={1} flexDirection="row" gap={2}>
            {slate('open-history', 'History', () => update($, viewAtom, () => 'history'))}
            {quiet('empty-close', 'Close', () => closeFlow($))}
          </Box>
        </Box>
      )
    }

    const names = ['Your prompt', 'Questions', 'Rewrite', 'Review']
    const current = stepIndex(flow)
    const wide = names.reduce((n, name) => n + name.length + 2, 0)
    const sep = cols >= wide + 18 ? '  ──  ' : cols >= wide + 9 ? ' ─ ' : ' '
    const isCompact = cols < wide + 9
    const tracker = (
      <Box flexDirection="row" marginTop={1}>
        {names.map((name, i) => {
          const isDone = i < current
          const isNow = i === current
          const mark = isDone ? '✓' : isNow ? '●' : '○'
          const color = isDone ? GREEN : isNow ? GOLD : MUTED

          return (
            <Box key={`t-${i}`} flexDirection="row">
              {i > 0 && <Text color={LINE}>{sep}</Text>}
              <Text color={color} bold={isNow}>
                {isCompact && !isNow ? mark : `${mark} ${name}`}
              </Text>
            </Box>
          )
        })}
      </Box>
    )

    const cancelButton = quiet('cancel', 'Cancel', () => cancel($))

    if (flow.step === 'compose') {
      return (
        <Box flexDirection="column" width={cols}>
          {header}
          {tracker}
          {rule('YOUR PROMPT')}
          {Input !== undefined ? (
            <Input
              key="compose"
              placeholder="Type a rough prompt and press Enter"
              autoFocus
              onSubmit={async value => {
                const text = value.trim()
                if (text.length === 0) return
                await patch($, flow.id, f => ({ ...f, original: text }))
                await runQuestions($, flow.id)
              }}
            />
          ) : (
            <Text color={MUTED}>Type /better followed by your prompt.</Text>
          )}
          <Box marginTop={1}>{cancelButton}</Box>
        </Box>
      )
    }

    if (flow.step === 'error') {
      return (
        <Box flexDirection="column" width={cols}>
          {header}
          {tracker}
          <Box flexDirection="column" borderStyle="round" borderColor={AMBER} paddingX={1} marginTop={1} width={cols}>
            <Text color={AMBER} bold>
              THE MODEL DID NOT ANSWER
            </Text>
            <Text color={TEXT}>Your prompt is safe. Nothing was sent.</Text>
            <Text color={MUTED}>{flow.errorText}</Text>
          </Box>
          <Box flexDirection="row" flexWrap="wrap" gap={1} marginTop={1}>
            {gold('retry', 'Try again', () =>
              flow.failedStep === 'rewriting' ? runRewrite($, flow.id) : runQuestions($, flow.id),
            )}
            {slate('send-original', 'Send my original', () => send($, flow.original))}
            {cancelButton}
          </Box>
        </Box>
      )
    }

    if (flow.step === 'reading' || flow.step === 'rewriting') {
      const given = Object.values(flow.answers).filter(a => !('skipped' in a)).length
      const line =
        flow.step === 'reading'
          ? 'Reading your prompt and choosing the questions that would help most.'
          : given > 0
            ? `Writing the upgrade from your prompt and ${given} answer${given === 1 ? '' : 's'}.`
            : 'Writing the upgrade from your prompt.'

      return (
        <Box flexDirection="column" width={cols}>
          {header}
          {tracker}
          {rule('YOUR PROMPT')}
          {card('original', 'AS YOU WROTE IT', flow.original, cols, LINE)}
          <Text color={MUTED}>{line}</Text>
          <Box marginTop={1}>{cancelButton}</Box>
        </Box>
      )
    }

    if (flow.step === 'questions') {
      const total = flow.questions.length
      const answered = flow.questions.filter((_, i) => {
        const a = flow.answers[String(i)]
        return a !== undefined && !('skipped' in a)
      }).length

      return (
        <Box flexDirection="column" width={cols}>
          {header}
          {tracker}
          {rule('QUESTIONS')}
          {flow.questions.map((question, i) => {
            const a = flow.answers[String(i)]
            const isSkipped = a !== undefined && 'skipped' in a
            const choice = a !== undefined && !('skipped' in a) ? a.choice : undefined
            const isOther = choice !== undefined && !question.options.includes(choice)
            const badge =
              choice !== undefined ? (
                <Text backgroundColor={GREEN} color={INK} bold>
                  {' ✓ '}
                </Text>
              ) : isSkipped ? (
                <Text backgroundColor={LINE} color={MUTED}>
                  {' – '}
                </Text>
              ) : (
                <Text backgroundColor={GOLD} color={INK} bold>{` ${i + 1} `}</Text>
              )

            return (
              <Box key={`q-${i}`} flexDirection="column" marginTop={1}>
                <Box flexDirection="row" gap={1}>
                  {badge}
                  <Box width={Math.max(10, cols - 4)}>
                    <Text color={TEXT}>{question.q}</Text>
                  </Box>
                </Box>
                <Box flexDirection="row" flexWrap="wrap" gap={1} paddingLeft={4} marginTop={1}>
                  {question.options.map((option, j) =>
                    option === choice
                      ? gold(`q${i}-o${j}`, option, () => answer($, flow.id, i, { choice: option }))
                      : slate(`q${i}-o${j}`, option, () => answer($, flow.id, i, { choice: option }), choice !== undefined),
                  )}
                  {isOther && choice !== undefined
                    ? gold(`q${i}-other`, fit(`Other: ${choice}`, Math.max(12, cols - 8)), () =>
                        patch($, flow.id, f => ({ ...f, otherOpen: i })),
                      )
                    : Input !== undefined &&
                      slate(`q${i}-other`, 'Other (type it)', () => patch($, flow.id, f => ({ ...f, otherOpen: i })))}
                  {quiet(`q${i}-skip`, isSkipped ? 'Skipped' : 'Skip', () => answer($, flow.id, i, { skipped: true }))}
                </Box>
                {flow.otherOpen === i && Input !== undefined && (
                  <Box paddingLeft={4} marginTop={1}>
                    <Input
                      key={`q${i}-input`}
                      placeholder="Type your answer and press Enter"
                      autoFocus
                      onSubmit={async value => {
                        const text = value.trim()
                        if (text.length > 0) await answer($, flow.id, i, { choice: text })
                      }}
                    />
                  </Box>
                )}
              </Box>
            )
          })}
          <Box flexDirection="row" flexWrap="wrap" gap={2} marginTop={1}>
            <Text color={MUTED}>{`${answered} of ${total} answered`}</Text>
            {gold('skip-rest', 'Skip the rest, upgrade now', () => runRewrite($, flow.id))}
            {cancelButton}
          </Box>
        </Box>
      )
    }

    const before = countWords(flow.original)
    const after = countWords(flow.upgraded)
    const stats: [string, number, string][] = [
      ['WORDS BEFORE', before, TEXT],
      ['WORDS AFTER', after, GOLD],
      ['DETAILS ADDED', flow.added.length, GREEN],
    ]
    const tileWidths = stats.map(([label, n]) => Math.max(label.length, bigNumber(n)[0].length) + 4)
    const isTiled = tileWidths.reduce((a, b) => a + b, 0) + 2 <= cols
    const numbers = isTiled ? (
      <Box flexDirection="row" gap={1} marginTop={1}>
        {stats.map(([label, n, color], i) => {
          const rows = bigNumber(n)

          return (
            <Box key={`s-${i}`} flexDirection="column" borderStyle="round" borderColor={LINE} paddingX={1} width={tileWidths[i]}>
              <Text color={color} mono>
                {rows[0]}
              </Text>
              <Text color={color} mono>
                {rows[1]}
              </Text>
              <Text color={color} mono>
                {rows[2]}
              </Text>
              <Text color={MUTED}>{label}</Text>
            </Box>
          )
        })}
      </Box>
    ) : (
      <Box marginTop={1}>
        <Text color={TEXT}>
          {fit(`${before} words before · ${after} after · ${flow.added.length} details added`, cols)}
        </Text>
      </Box>
    )

    const isSideBySide = cols >= 70
    const half = isSideBySide ? Math.floor((cols - 1) / 2) : cols

    return (
      <Box flexDirection="column" width={cols}>
        {header}
        {tracker}
        {numbers}
        <Box flexDirection="row" flexWrap="wrap" gap={1} marginTop={1}>
          {gold('run', 'Run it', () => send($, flow.upgraded))}
          {Input !== undefined &&
            slate('edit', flow.isEditing ? 'Stop editing' : 'Edit', () =>
              patch($, flow.id, f => ({ ...f, isEditing: !f.isEditing })),
            )}
          {slate('copy', flow.isCopied ? 'Copied' : 'Copy', async () => {
            const copied = await $.ui.copy({ text: flow.upgraded, surface: e.surface })
            if (copied.isCopied) await patch($, flow.id, f => ({ ...f, isCopied: true }))
          })}
          {slate('history', 'History', () => update($, viewAtom, () => 'history'))}
          {cancelButton}
        </Box>
        {flow.isEditing && Input !== undefined && (
          <Box flexDirection="column" marginTop={1}>
            <Input
              key="edit-input"
              value={flow.upgraded}
              rows={6}
              autoFocus
              onInput={value => void patch($, flow.id, f => ({ ...f, upgraded: value, isCopied: false }))}
              onSubmit={value => void send($, value.trim().length > 0 ? value : flow.upgraded)}
            />
            <Text color={MUTED}>Enter runs it.</Text>
          </Box>
        )}
        {rule('WHAT I ADDED')}
        {flow.added.length === 0 && <Text color={MUTED}>Nothing listed.</Text>}
        {flow.added.map((item, i) => (
          <Box key={`a-${i}`} flexDirection="row">
            <Text color={GREEN}>+ </Text>
            <Box width={Math.max(10, cols - 2)}>
              <Text color={TEXT}>{item}</Text>
            </Box>
          </Box>
        ))}
        {rule('SIDE BY SIDE')}
        <Box flexDirection={isSideBySide ? 'row' : 'column'} gap={1}>
          {card('left', 'YOUR PROMPT', flow.original, half, LINE)}
          {card('right', 'UPGRADE', flow.upgraded, half, GOLD)}
        </Box>
      </Box>
    )
  })
}

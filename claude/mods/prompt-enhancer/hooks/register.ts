import type { EngineInterface, Register } from 'claude-code'

import { askBody, buildPrompt, buildSystem, cleanReply, cleanRules, parseMinWords, shouldOffer } from './logic'

const ENABLED_KEY = 'enabled'
const MODEL = 'claude-haiku-5-5'
const TIMEOUT_MS = 20_000

const IMPROVE = 'Improve prompt'
const DISMISS = 'Dismiss'
const SEND_IMPROVED = 'Send improved'
const EDIT = 'Edit'
const SEND_ORIGINAL = 'Send original'

// Resolves the picked label, or the fallback when dismissed or nobody can answer.
async function ask($: EngineInterface, question: string, options: readonly string[], fallback: string): Promise<string> {
  try {
    return await $.ui.ask(question, { header: 'Enhance', options })
  } catch {
    return fallback
  }
}

export const register: Register = (on, options) => {
  const min = parseMinWords(options.minWords)
  const rules = cleanRules(options.rules)

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'enhance',
      description: 'Offer to rewrite long prompts: on | off',
      argumentHint: 'on | off',
    })
    return next(e)
  })

  on('command.run', { command: 'enhance' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'on' || arg === 'off') {
      await $.store.set(ENABLED_KEY, arg === 'on')
      return { text: `prompt-enhancer is ${arg}.` }
    }
    const state = (await $.store.get(ENABLED_KEY)) === true ? 'on' : 'off'
    return { text: `prompt-enhancer is ${state}. Use: /enhance on | off` }
  })

  on('prompt.submit', async ($, e, next) => {
    // Only the user's own Enter, never a notification, a schedule or another plugin.
    if (e.isMeta || e.command || e.origin?.kind !== 'composer') return next(e)
    const isEnabled = (await $.store.get(ENABLED_KEY)) === true
    if (!shouldOffer(e.text, isEnabled, min)) return next(e)

    if ((await ask($, 'Improve this prompt?', [IMPROVE, DISMISS], DISMISS)) !== IMPROVE) return next(e)

    const reply = await $.model
      .complete({ model: MODEL, system: buildSystem(rules), prompt: buildPrompt(e.text), maxTokens: 4000, timeoutMs: TIMEOUT_MS })
      .catch(() => undefined)
    const improved = reply?.isAnswered ? cleanReply(reply.text) : undefined
    if (improved === undefined) {
      $.ui.toast('Prompt enhancer failed, sending your original.')
      return next(e)
    }

    const choice = await ask($, askBody(improved), [SEND_IMPROVED, EDIT, SEND_ORIGINAL], SEND_ORIGINAL)
    if (choice === SEND_IMPROVED) return next({ ...e, text: improved })
    if (choice === EDIT) {
      $.clock.after(300, () => void $.prompt.fill({ text: improved, mode: 'replace' }).catch(() => undefined))
      return { drop: 'Improved prompt placed in the input.' }
    }
    return next(e)
  }).catch(($, e, next) => next(e))
}

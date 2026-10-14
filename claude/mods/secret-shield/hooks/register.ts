import type { EngineInterface, Register } from 'claude-code'

import { detect, mask, redact } from './logic'
import type { Finding } from './logic'

const REDACT = 'Redact & send'
const SEND = 'Send anyway'
const CANCEL = 'Cancel'
const REDACT_WRITE = 'Redact & write'
const WRITE = 'Write anyway'

const summary = (findings: readonly Finding[]) =>
  [...new Set(findings.map(f => `${f.kind} ${mask(f.value)}`))].slice(0, 3).join(', ')

// Resolves the picked label, or CANCEL when dismissed or nobody can answer.
async function ask($: EngineInterface, question: string, options: readonly string[]): Promise<string> {
  try {
    return await $.ui.ask(question, { header: 'Secret', options })
  } catch {
    return CANCEL
  }
}

// Inside a git repo and not gitignored: content written there can end up in a commit.
async function isTracked($: EngineInterface, file: string): Promise<boolean> {
  const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) || '/' : '.'
  const run = await $.process.run(['git', '-C', dir, 'check-ignore', '-q', file], { timeoutMs: 5_000 }).catch(() => undefined)
  // check-ignore: 0 ignored, 1 not ignored, 128 not a repo / error.
  return run?.exitCode === 1
}

export const register: Register = (on, options) => {
  const headers = (options.extraHeaders as readonly string[] | undefined) ?? []

  on('prompt.submit', async ($, e, next) => {
    if (e.isMeta) return next(e)
    const findings = detect(e.text, { headers })
    if (findings.length === 0) return next(e)

    const choice = await ask($, `Possible secret in your prompt (${summary(findings)}). What now?`, [REDACT, SEND, CANCEL])
    if (choice === SEND) return next(e)
    if (choice === REDACT) return next({ ...e, text: redact(e.text, findings) })

    // Put the text back so it can be edited instead of retyped.
    $.clock.after(300, () => void $.prompt.fill({ text: e.text, mode: 'replace' }).catch(() => undefined))
    return { drop: 'secret-shield: not sent. Your prompt is back in the box to edit.' }
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const findings = detect(e.content, { entropy: false, headers })
    if (findings.length === 0 || !(await isTracked($, e.file_path))) return next(e)
    const choice = await ask($, `Writing a possible secret (${summary(findings)}) to ${e.file_path}, which git tracks. What now?`, [REDACT_WRITE, WRITE, CANCEL])
    if (choice === WRITE) return next(e)
    if (choice === REDACT_WRITE) return next({ ...e, content: redact(e.content, findings) })
    return { deny: `secret-shield: ${e.file_path} would contain a secret (${summary(findings)}). Use an env var, user-secrets or a gitignored file instead.` }
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    const findings = detect(e.new_string, { entropy: false, headers })
    if (findings.length === 0 || !(await isTracked($, e.file_path))) return next(e)
    const choice = await ask($, `Writing a possible secret (${summary(findings)}) to ${e.file_path}, which git tracks. What now?`, [REDACT_WRITE, WRITE, CANCEL])
    if (choice === WRITE) return next(e)
    if (choice === REDACT_WRITE) return next({ ...e, new_string: redact(e.new_string, findings) })
    return { deny: `secret-shield: ${e.file_path} would contain a secret (${summary(findings)}). Use an env var, user-secrets or a gitignored file instead.` }
  }).catch(($, e, next) => next(e))
}

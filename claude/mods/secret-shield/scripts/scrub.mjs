#!/usr/bin/env node
// Finds (and with --apply, redacts) secrets in Claude Code's local logs.
//
//   node scrub.mjs            dry run: masked hit list, nothing changes
//   node scrub.mjs --apply    back up each changed file, then rewrite it redacted
//
// Scans ~/.claude/history.jsonl, ~/.claude/projects/**/*.jsonl and ~/.claude/paste-cache/*.
// Skips files changed in the last 5 minutes (live sessions are still writing them).
// Extra header names come from settings.json -> pluginConfigs["secret-shield…"].options.extraHeaders.
import fs from 'node:fs'
import path from 'node:path'

import { detect, mask, redact } from '../hooks/logic.ts'

const CLAUDE = process.env.CLAUDE_CONFIG_DIR ?? path.join(process.env.HOME, '.claude')
const APPLY = process.argv.includes('--apply')
const LIVE_MS = 5 * 60_000
const HEADERS = (() => {
  try {
    const configs = JSON.parse(fs.readFileSync(path.join(CLAUDE, 'settings.json'), 'utf8')).pluginConfigs ?? {}
    return Object.entries(configs).find(([k]) => k.split('@')[0] === 'secret-shield')?.[1]?.options?.extraHeaders ?? []
  } catch {
    return []
  }
})()
// Fields that hold ids, signatures or base64 media: never secrets, often high-entropy.
const SKIP_KEYS = new Set(['signature', 'data', 'uuid', 'parentUuid', 'leafUuid', 'sessionId', 'requestId', 'id', 'tool_use_id', 'promptId', 'messageId'])

function files() {
  const out = [path.join(CLAUDE, 'history.jsonl')]
  const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.jsonl')) out.push(p)
    }
  }
  walk(path.join(CLAUDE, 'projects'))
  const paste = path.join(CLAUDE, 'paste-cache')
  if (fs.existsSync(paste)) for (const n of fs.readdirSync(paste)) out.push(path.join(paste, n))
  return out.filter(f => fs.existsSync(f) && fs.statSync(f).isFile())
}

// The high-entropy rule only runs on what the person typed or pasted (history, paste cache, user
// prompts); tool output gets the precise patterns alone, or base64 and ids flood the list.
function isTyped(file, line) {
  if (!file.includes(`${path.sep}projects${path.sep}`)) return true
  if (line.type !== 'user' || line.isMeta) return false
  const content = line.message?.content
  return typeof content === 'string' || (Array.isArray(content) && content.every(b => b.type !== 'tool_result'))
}

// Redacts every string value in a parsed JSON value; returns findings through `hits`.
function scrubValue(value, hits, entropy, key = '') {
  if (typeof value === 'string') {
    if (SKIP_KEYS.has(key)) return value
    const found = detect(value, { entropy, headers: HEADERS })
    if (found.length === 0) return value
    hits.push(...found)
    return redact(value, found)
  }
  if (Array.isArray(value)) return value.map(v => scrubValue(v, hits, entropy))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrubValue(v, hits, entropy, k)]))
  }
  return value
}

function scrubFile(file) {
  const text = fs.readFileSync(file, 'utf8')
  const hits = []
  if (!file.endsWith('.jsonl')) {
    const found = detect(text, { entropy: true, headers: HEADERS })
    return { hits: found, next: found.length ? redact(text, found) : text }
  }
  const lines = text.split('\n').map(line => {
    if (!line.trim()) return line
    let parsed
    try {
      parsed = JSON.parse(line)
    } catch {
      return line
    }
    const before = hits.length
    const cleaned = scrubValue(parsed, hits, isTyped(file, parsed))
    return hits.length === before ? line : JSON.stringify(cleaned)
  })
  return { hits, next: lines.join('\n') }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupRoot = path.join(CLAUDE, '.backups', `secret-scrub-${stamp}`)
const byValue = new Map()
const byFile = []
const skipped = []

for (const file of files()) {
  // history.jsonl only grows by one line per prompt, so it's safe to rewrite; live transcripts are not.
  if (!file.endsWith('history.jsonl') && Date.now() - fs.statSync(file).mtimeMs < LIVE_MS) {
    skipped.push(file)
    continue
  }
  const { hits, next } = scrubFile(file)
  if (hits.length === 0) continue
  byFile.push([path.relative(CLAUDE, file), hits.length])
  for (const h of hits) {
    const entry = byValue.get(h.value) ?? { kind: h.kind, count: 0, files: new Set() }
    entry.count++
    entry.files.add(path.relative(CLAUDE, file).split(path.sep)[0])
    byValue.set(h.value, entry)
  }
  if (APPLY) {
    const backup = path.join(backupRoot, path.relative(CLAUDE, file))
    fs.mkdirSync(path.dirname(backup), { recursive: true, mode: 0o700 })
    fs.copyFileSync(file, backup)
    fs.writeFileSync(file, next)
  }
}

console.log(`${APPLY ? 'REDACTED' : 'DRY RUN'}: ${byValue.size} distinct values, ${[...byValue.values()].reduce((n, e) => n + e.count, 0)} hits in ${byFile.length} files\n`)
const rows = [...byValue.entries()].sort((a, b) => b[1].count - a[1].count)
for (const [value, e] of rows) console.log(`${e.kind.padEnd(20)} ${mask(value).padEnd(18)} ×${String(e.count).padEnd(4)} ${[...e.files].join(', ')}`)
if (skipped.length) console.log(`\nSkipped ${skipped.length} file(s) changed in the last 5 min (live sessions):\n  ${skipped.map(f => path.relative(CLAUDE, f)).join('\n  ')}`)
if (APPLY) console.log(`\nBackups (they still hold the secrets): ${backupRoot}\nDelete them once you've checked: rm -rf "${backupRoot}"`)

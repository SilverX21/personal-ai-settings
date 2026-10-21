// Pure secret detection: no engine calls, so tests and the scrub script (node) run it directly.

export type Finding = { kind: string; start: number; end: number; value: string }

type Rule = { kind: string; pattern: RegExp; group?: number }

const RULES: readonly Rule[] = [
  { kind: 'private-key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { kind: 'azure-devops-pat', pattern: /\b[A-Za-z0-9]{76}AZDO[A-Za-z0-9]{4}\b/g },
  { kind: 'azure-devops-pat', pattern: /(?<![A-Za-z0-9])[a-z2-7]{52}(?![A-Za-z0-9])/g },
  { kind: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { kind: 'aws-access-key', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { kind: 'aws-secret-key', pattern: /aws_secret_access_key\s*[=:]\s*["']?([A-Za-z0-9/+=]{40})/gi, group: 1 },
  { kind: 'github-token', pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { kind: 'anthropic-key', pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}/g },
  { kind: 'openai-key', pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}/g },
  { kind: 'slack-token', pattern: /\bxox[abpors]-[A-Za-z0-9-]{10,}/g },
  // Connection strings have no spaces around '=' (code like `Password = AppRole` does).
  // Placeholders and variables (`<…>`, `$X`, `{X}`, `%X%`) are not passwords.
  { kind: 'connection-password', pattern: /\b(?:Password|Pwd)=(?![<${%])([^;"'\s*]{4,})/gi, group: 1 },

  // Any field named like a secret, in any format: header, JSON/YAML key, env var, URL parameter
  // (x-api-key, clientSecret, AUTH_TOKEN, db_password, sig=). The value check below drops the false ones.
  {
    kind: 'named-secret',
    // The name prefix is capped: unbounded, a long run of `a-a-a-…` is rescanned from every start (quadratic).
    pattern: /(?<![A-Za-z0-9])[A-Za-z0-9_.-]{0,64}(?:key|secret|token|passw(?:or)?d|pwd|credentials?|auth(?:orization)?|sig(?:nature)?)["']?\s*[:=]\s*["']?(?:Bearer\s+|Basic\s+)?([^\s"',;&\\`]{16,})/gi,
    group: 1,
  },
]

// Long runs with letters and digits; '/' and '.' split them so paths and URLs stay apart.
const CANDIDATE = /[A-Za-z0-9_+=-]{32,}/g
const ALLOWED: readonly RegExp[] = [
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, // GUID
  /^[0-9a-f]+$/i, // hex: commit SHAs, hashes, GUIDs without dashes, EUIs
  /^(?:[A-Za-z]+|[0-9]+)(?:[-_](?:[A-Za-z]+|[0-9]+))*$/, // identifiers: each -/_ part all letters or all digits (my-repo-01)
]

export function entropy(s: string): number {
  const counts = new Map<string, number>()
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1)
  let bits = 0
  for (const n of counts.values()) bits -= (n / s.length) * Math.log2(n / s.length)
  return bits
}

// Env and code names (MY_KEY, __ENV.API_SECRET_V2, ${CI_TOKEN}): every part letters or digits;
// with two or more parts an ALL-CAPS part may mix them (V2), a lone one may not (hex keys).
function isName(s: string): boolean {
  const parts = s.replace(/^\$?\{|\}$/g, '').split(/[-_.]/).filter(Boolean)
  const part = parts.length > 1 ? /^(?:[A-Za-z]+|[0-9]+|[A-Z0-9]+)$/ : /^(?:[A-Za-z]+|[0-9]+)$/
  return parts.every(p => part.test(p))
}

// Placeholders, variables and names after `api-key:` are not secrets.
function isNamedSecret(name: string, value: string): boolean {
  if (/^public/i.test(name)) return false // .NET PublicKeyToken, public keys
  if (ALLOWED[0]!.test(value) || isName(value)) return false
  if (/^[$<{%]|^\*{3,}|REDACTED|YOUR_|xxx|example/i.test(value)) return false
  if (/[():]|^[/~.]|^\d{4}-\d{2}-\d{2}/.test(value)) return false // code, composite keys, URLs, paths, dates
  return /[0-9]/.test(value) && /[A-Za-z]/.test(value)
}

function looksRandom(s: string): boolean {
  if (ALLOWED.some(r => r.test(s))) return false
  if (!/[0-9]/.test(s) || !/[A-Za-z]/.test(s)) return false
  if (!/[a-z]/.test(s) || !/[A-Z]/.test(s)) return false
  return entropy(s) > 4
}

export type DetectOptions = { entropy?: boolean }

/** `entropy: false` keeps only the precise patterns: use it for tool output, where ids and base64 abound. */
export function detect(text: string, { entropy: useEntropy = true }: DetectOptions = {}): Finding[] {
  const found: Finding[] = []
  const overlaps = (start: number, end: number) => found.some(f => start < f.end && end > f.start)

  for (const rule of RULES) {
    for (const m of text.matchAll(rule.pattern)) {
      const value = rule.group ? m[rule.group] : m[0]
      if (!value || m.index === undefined) continue
      const start = m.index + m[0].lastIndexOf(value)
      const end = start + value.length
      if (rule.kind === 'named-secret' && !isNamedSecret(m[0], value)) continue
      if (!overlaps(start, end)) found.push({ kind: rule.kind, start, end, value })
    }
  }
  if (!useEntropy) return found.sort((a, b) => a.start - b.start)
  for (const m of text.matchAll(CANDIDATE)) {
    const start = m.index ?? 0
    const end = start + m[0].length
    if (looksRandom(m[0]) && !overlaps(start, end)) found.push({ kind: 'high-entropy', start, end, value: m[0] })
  }
  return found.sort((a, b) => a.start - b.start)
}

export function redact(text: string, findings: readonly Finding[] = detect(text)): string {
  let out = text
  for (const f of [...findings].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, f.start) + `<REDACTED:${f.kind}>` + out.slice(f.end)
  }
  return out
}

/** First 4 and last 2 characters only, so a preview never prints the secret again. */
export function mask(value: string): string {
  return value.length <= 8 ? '*'.repeat(value.length) : `${value.slice(0, 4)}…${value.slice(-2)} (${value.length})`
}

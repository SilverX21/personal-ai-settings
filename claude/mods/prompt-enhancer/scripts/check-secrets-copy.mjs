#!/usr/bin/env node
// hooks/secrets.ts is a verbatim copy of secret-shield's hooks/logic.ts (installed mods cannot import each other).
// Run from the repo: exits 1 when the copy has drifted.
import fs from 'node:fs'

const copy = new URL('../hooks/secrets.ts', import.meta.url)
const original = new URL('../../secret-shield/hooks/logic.ts', import.meta.url)
if (fs.readFileSync(copy, 'utf8') !== fs.readFileSync(original, 'utf8')) {
  console.error('prompt-enhancer/hooks/secrets.ts differs from secret-shield/hooks/logic.ts: cp it over.')
  process.exit(1)
}
console.log('secrets.ts matches secret-shield/hooks/logic.ts')

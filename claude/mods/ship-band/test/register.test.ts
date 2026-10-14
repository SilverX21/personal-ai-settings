import { expect, mock, test } from 'claude-code/testing'

// Drives the hooks with real-looking events and reads the result through `/ship-band`.
function world(on: any, branch: { name: string }) {
  mock.store(on)
  on('session.repo', () => ({ value: { root: '/repo', remote: null, internal: false, name: null } }))
  on('process.run', (_$: unknown, e: { argv: readonly string[] }) => ({
    value: { exitCode: 0, stdout: e.argv[0] === 'git' ? `${branch.name}\n` : '', stderr: '' },
  }))
  on('session.start', () => ({ cwd: '/repo' }))
  on('turn.complete', () => ({ text: '' }))
  on('command.register', () => ({ value: undefined }))
  on('tool.call', { tool: ['Edit', 'Write', 'Skill', 'ExitPlanMode'] }, () => ({ result: 'ok' }))
  on('tool.call', { tool: 'Bash' }, (_$: unknown, e: { command: string }) => ({ result: 'ok', text: e.command }))
}

const status = ($: any) =>
  $.command.run({ command: 'ship-band', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })

test('edits and a passing test run move the band; the id comes from the branch', async ($, on) => {
  world(on, { name: 'feat/12345-export' })
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Edit', file_path: '/repo/src/a.ts', old_string: 'a', new_string: 'b' })
  await $.tool.call({ tool: 'Bash', command: 'pnpm nx affected -t test' })
  const { text } = await status($)
  expect(text).toContain('#12345 feat/12345-export')
  expect(text).toContain('WI ✓ Plan ● Impl ✓ Tests ✓')
})

test('state is kept per branch', async ($, on) => {
  const branch = { name: 'feat/one' }
  world(on, branch)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Edit', file_path: '/repo/src/a.ts', old_string: 'a', new_string: 'b' })
  expect((await status($)).text).toContain('Impl ✓')

  branch.name = 'feat/two'
  await $.tool.call({ tool: 'Bash', command: 'git switch feat/two' })
  expect((await status($)).text).toContain('Impl ○')

  branch.name = 'feat/one'
  await $.tool.call({ tool: 'Bash', command: 'git switch feat/one' })
  expect((await status($)).text).toContain('Impl ✓')
})

test('source can be set per repo and hides the WI step', async ($, on) => {
  world(on, { name: 'feat/one' })
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  const set = await $.command.run({ command: 'ship-band', args: 'source none', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  expect(set.text).toContain('none')
  const { text } = await status($)
  expect(text).not.toContain('WI')
  expect(text).toContain('Plan ●')
})

test('the branch in use survives eviction: revisiting it moves it to the newest slot', async ($, on) => {
  const branch = { name: 'feat/keep' }
  world(on, branch)
  const go = async (name: string) => {
    branch.name = name
    await $.tool.call({ tool: 'Bash', command: `git switch ${name}` })
  }
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Edit', file_path: '/repo/src/a.ts', old_string: 'a', new_string: 'b' })
  for (let i = 0; i < 30; i++) await go(`feat/a-${i}`)
  await go('feat/keep')
  for (let i = 0; i < 30; i++) await go(`feat/b-${i}`)
  await go('feat/keep')
  expect((await status($)).text).toContain('Impl ✓')
})

const turnEnd = ($: any, reason: 'answer' | 'aborted' = 'answer') =>
  $.turn.complete({ reason, answer: '', durationMs: 1, isAborted: reason === 'aborted', turnId: 't1' })

const start = ($: any) => $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
const cmd = ($: any, args: string) =>
  $.command.run({ command: 'ship-band', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })

test('a skill counts as done when its turn ends, and stale if an edit came after it', async ($, on) => {
  world(on, { name: 'feat/one' })
  await start($)

  await $.tool.call({ tool: 'Skill', skill: 'code-review' })
  expect((await status($)).text).toContain('Review ○')
  await turnEnd($)
  expect((await status($)).text).toContain('Review ✓')

  await $.tool.call({ tool: 'Skill', skill: 'security-review' })
  await $.tool.call({ tool: 'Edit', file_path: '/repo/src/a.ts', old_string: 'a', new_string: 'b' })
  await turnEnd($)
  const { text } = await status($)
  expect(text).toContain('Security ⟳')
  expect(text).toContain('Review ⟳')
})

test('an aborted turn does not count the skill, and a plugin-prefixed name is understood', async ($, on) => {
  world(on, { name: 'feat/one' })
  await start($)
  await $.tool.call({ tool: 'Skill', skill: 'code-review' })
  await turnEnd($, 'aborted')
  expect((await status($)).text).toContain('Review ○')

  await $.tool.call({ tool: 'Skill', skill: 'my-plugin:code-review' })
  await turnEnd($)
  expect((await status($)).text).toContain('Review ✓')
})

test('ExitPlanMode marks Plan, and a write to docs/plans does too but other docs do not', async ($, on) => {
  world(on, { name: 'feat/one' })
  await start($)
  await $.tool.call({ tool: 'ExitPlanMode' })
  expect((await status($)).text).toContain('Plan ✓')

  await cmd($, 'reset')
  expect((await status($)).text).toContain('Plan ○')
  await $.tool.call({ tool: 'Write', file_path: '/repo/README.md', content: 'x' })
  expect((await status($)).text).toContain('Impl ○')
  await $.tool.call({ tool: 'Write', file_path: '/repo/docs/plans/x.md', content: 'x' })
  expect((await status($)).text).toContain('Plan ✓')
})

test('reset clears the branch and off/on switch the band', async ($, on) => {
  world(on, { name: 'feat/12345-x' })
  await start($)
  await $.tool.call({ tool: 'Edit', file_path: '/repo/src/a.ts', old_string: 'a', new_string: 'b' })
  expect((await status($)).text).toContain('Impl ✓')

  expect((await cmd($, 'reset')).text).toContain('cleared')
  const after = (await status($)).text
  expect(after).toContain('Impl ○')
  expect(after).toContain('WI ✓') // the branch name still gives the id

  expect((await cmd($, 'off')).text).toBe('ship-band is off.')
  expect((await cmd($, 'on')).text).toBe('ship-band is on.')
})

test('the band keeps what the hooks below it drew', async ($, on) => {
  world(on, { name: 'feat/12345-export' })
  on('ui.render', ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return Text({ children: 'other band' })
  })
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({
    plugin: 'ship-band',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 5, bodyColumns: 120, scroll: { offset: 0, bodyRows: 5 }, view: {} },
  })
  expect(await ui.find({ type: 'Text', text: /other band/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /#12345 feat\/12345-export/ })).toBeDefined()
  await ui.unmount()
})

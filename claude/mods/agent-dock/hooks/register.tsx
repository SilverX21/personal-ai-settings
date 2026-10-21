import type { Register } from 'claude-code'

import { registerAgentDock } from './dock'

export const register: Register = on => {
  registerAgentDock(on)
}

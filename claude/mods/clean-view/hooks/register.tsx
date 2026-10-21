import type { Register } from 'claude-code'

import { registerCleanView } from './clean-view'
import { registerAgentDock } from './dock'

// Each mod registers its hooks here. The dock goes first so its hook answers
// a helper's report_progress before Clean View's would.
export const register: Register = on => {
  registerAgentDock(on)
  registerCleanView(on)
}

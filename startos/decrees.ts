import { decreeLog } from './fileModels/decreeLog'
import { parseSetupState } from './setupState'

export type { SetupState } from './setupState'
export { parseSetupState } from './setupState'

/**
 * Snapshot read of the setup state, for use inside actions.
 *
 * `.once()` rather than `.const(effects)` on purpose: an action wants the
 * current value, not a subscription that would re-trigger its caller. The
 * reactive path — the one that has to notice the daemon creating this file —
 * lives in `init/setup.ts` and reads the same model with `.const(effects)`.
 *
 * The parsing itself lives in `setupState.ts`, which is import-free so it can
 * be unit-tested without the SDK. See the comment there.
 */
export async function readSetupState() {
  return parseSetupState(await decreeLog.read((s) => s).once())
}

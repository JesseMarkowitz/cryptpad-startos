import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

/**
 * - adminKeys: CryptPad admin public signing keys mirrored into config.js
 *   adminKeys array. The "Add Administrator by Public Key" action manages
 *   this list. The day-to-day path for managing admins is CryptPad's own
 *   /admin/#support panel — this field is for first-admin emergency access
 *   (when the install token URL was missed) or bulk add/remove from outside
 *   the running app.
 *
 * - mainUrl / sandboxUrl: the user's chosen URLs for the two CryptPad
 *   origins. Both must be set before the daemon can start — the 'critical'
 *   task severity in init/setup.ts is the gate. Stored as nullable strings
 *   rather than empty-string-default because "no URL set yet" is a
 *   meaningfully different state from "the user picked the empty URL," and
 *   using null lets the watcher in init/setup.ts cleanly distinguish them.
 *
 * - wizardCompletedNotified: one-shot latch for the "setup complete"
 *   notification. The reactive watcher in init/setup.ts posts the
 *   notification the first time it sees an ADD_ADMIN_KEY decree (i.e. the
 *   install wizard finished), then flips this to true so subsequent
 *   re-runs are no-ops. Without the latch we'd post a notification on every
 *   container rebuild for the rest of the install's life.
 */
const shape = z.object({
  adminKeys: z.array(z.string()).catch([]),
  mainUrl: z.string().nullable().catch(null),
  sandboxUrl: z.string().nullable().catch(null),
  wizardCompletedNotified: z.boolean().catch(false),
})

export const storeJson = FileHelper.json(
  { base: sdk.volumes.main, subpath: 'store.json' },
  shape,
)

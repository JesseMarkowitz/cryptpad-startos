import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

/**
 * v1 store.json — three fields, deliberately minimal.
 *
 * - adminKeys: CryptPad admin public signing keys mirrored into config.js
 *   adminKeys array. The "Add Administrator by Public Key" action manages
 *   this list. The day-to-day path for managing admins is CryptPad's own
 *   /admin/#support panel — this field is for first-admin emergency access
 *   (when the install token URL was missed) or bulk add/remove from outside
 *   the running app.
 *
 * - mainUrl / sandboxUrl: the user's chosen URLs for the two CryptPad
 *   origins. Both must be set before the daemon can start (PLAN §7.4 — the
 *   'critical' task severity in init/setup.ts is the gate). Stored as
 *   nullable strings rather than empty-string-default because "no URL set
 *   yet" is a meaningfully different state from "the user picked the empty
 *   URL," and using null lets the watcher in init/setup.ts cleanly
 *   distinguish them.
 *
 * Everything from the prior attempt's 8-field store (adminEmail, termsUrl,
 * privacyUrl, maxUploadSize, maxWorkerCount, restrictRegistration,
 * allowEmbedding) is intentionally dropped — the in-app /admin/ panel covers
 * all of them. See PLAN §3 and §6.
 */
const shape = z.object({
  adminKeys: z.array(z.string()).catch([]),
  mainUrl: z.string().nullable().catch(null),
  sandboxUrl: z.string().nullable().catch(null),
})

export const storeJson = FileHelper.json(
  { base: sdk.volumes.main, subpath: 'store.json' },
  shape,
)
